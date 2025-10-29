import { LlmChunk, LlmCompletionOpts, LlmEngine, LlmResponse, Model } from 'multi-llm-ts'
import Message from '../models/message'
import { Configuration, EngineConfig } from '../types/config'
import { DocRepoQueryResponseItem } from '../types/rag'
import { i18nInstructions, t } from './i18n'

export type GenerationEvent = 'before_generation' | 'plugins_disabled' | 'before_title' | 'generation_done'

export type GenerationCallback = (event: GenerationEvent) => void

export interface GenerationOpts extends LlmCompletionOpts {
  model: string
  streaming?: boolean
  docrepo?: string
  sources?: boolean
  noToolsInContent?: boolean
}

export type LlmChunkCallback = (chunk: LlmChunk) => void

export type GenerationResult = 
  'success' |
  'stopped' |
  'missing_api_key' |
  'out_of_credits' |
  'quota_exceeded' |
  'context_too_long' |
  'invalid_model' |
  'invalid_budget' |
  'function_description_too_long' |
  'function_call_not_supported' |
  'streaming_not_supported' |
  'error'

export default class Generator {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  async generate(llm: LlmEngine, messages: Message[], opts: GenerationOpts, llmCallback?: LlmChunkCallback): Promise<GenerationResult> {

    // return code
    let rc: GenerationResult = 'success'

    // get messages
    const response = messages[messages.length - 1]
    const conversation = this.getConversation(messages)

    // check config
    const engineConfig: EngineConfig = this.config.engines[llm.getId()]
    if (!engineConfig?.models?.chat?.length) {
      response.setText(t('generator.errors.missingApiKey'))
      return 'missing_api_key'
    }

    // check the model
    const model = engineConfig?.models?.chat?.find((m: Model) => m.id === opts.model)
    const visionModel = engineConfig?.models?.chat?.find((m: Model) => m.id === engineConfig.model?.vision)
    if (!model) {
      response.setText(t('generator.errors.invalidModel'))
      return 'invalid_model'
    }

    // use tools always
    model.capabilities.tools = true

    try {

      // rag?
      let sources: DocRepoQueryResponseItem[] = [];
      if (opts.docrepo) {
        const userMessage = conversation[conversation.length - 1];
        sources = await window.api.docrepo.query(opts.docrepo, userMessage.content);
        //console.log('Sources', JSON.stringify(sources, null, 2));
        if (sources.length > 0) {
          const context = sources.map((source) => source.content).join('\n\n');
          const instructions = i18nInstructions(this.config, 'instructions.chat.docquery')
          const prompt = instructions.replace('{context}', context).replace('{query}', userMessage.content);
          conversation[conversation.length - 1] = new Message('user', prompt);
        }
      }

      // debug
      //console.log(`Generation with ${llm.plugins.length} plugins and opts ${JSON.stringify(opts)}`)

      if (opts.streaming === false) {

        // normal completion
        const llmResponse: LlmResponse = await llm.complete(model, conversation, {
          visionFallbackModel: visionModel,
          usage: true,
          ...opts
        })

        // // fake tool calls
        // for (const toolCall of llmResponse.toolCalls) {
        //   const chunk: LlmChunk = {
        //     type: 'tool',
        //     id: crypto.randomUUID(),
        //     name: toolCall.name,
        //     call: {
        //       params: toolCall.params,
        //       result: toolCall.result
        //     },
        //     done: true
        //   }
        //   callback?.call(null, chunk)
        // }

        // fake streaming
        const chunk: LlmChunk = {
          type: 'content',
          text: llmResponse.content,
          done: true
        }

        // append text
        response.appendText(chunk)
        response.usage = llmResponse.usage
        llmCallback?.call(null, chunk)

      } else {

        // now stream
        const stream = llm.generate(model, conversation, {
          visionFallbackModel: visionModel,
          usage: true,
          ...opts
        })

        // we need this to catch errors in the for-await loop
         
        try {
          for await (const msg of stream) {
            // Engine will stop if signal aborted
            if (msg.type === 'usage') {
              response.usage = msg.usage
              llmCallback?.call(null, msg)
            } else if (msg.type === 'tool') {
              response.addToolCall(msg, opts.noToolsInContent ? false : true)
              llmCallback?.call(null, msg)
            } else if (msg.type === 'content') {
              if (msg && sources && sources.length > 0) {
                msg.done = false
              }
              response.appendText(msg)
              llmCallback?.call(null, msg)
            } else if (msg.type === 'reasoning') {
              response.appendText(msg)
              llmCallback?.call(null, msg)
            }
          }
        } catch (error) {
          rc = await this.handleError(error, llm, messages, opts, response, llmCallback)
          return rc
        }

      }

      // append sources
      if (opts.docrepo && opts.sources && sources && sources.length > 0) {

        // reduce to unique sources based on metadata.id
        const uniqueSourcesMap = new Map();
        sources.forEach(source => {
          uniqueSourcesMap.set(source.metadata.uuid, source);
        })
        sources = Array.from(uniqueSourcesMap.values());

        // now add them
        let sourcesText = '\n\nSources:\n\n'
        sourcesText += sources.map((source) => `- [${source.metadata.title}](${source.metadata.url})`).join('\n')
        response.appendText({ type: 'content', text: sourcesText, done: true })
        llmCallback?.call(null, { type: 'content', text: sourcesText, done: true })
      }

    } catch (error) {
      
      rc = await this.handleError(error, llm, messages, opts, response, llmCallback)
    
    } finally {

      // make sure the message is terminated correctly
      // https://github.com/nbonamy/witsy/issues/104
      if (response.transient) {
        console.warn('Response is still transient. Appending empty text.')
        response.appendText({ type: 'content', text: '', done: true })
      }

    }

    // done
    return rc

  }

  private async handleError(
    error: any,
    llm: LlmEngine,
    messages: Message[],
    opts: GenerationOpts,
    response: Message,
    llmCallback?: LlmChunkCallback
  ): Promise<GenerationResult> {

    console.error('Error while generating text', error)

    if (error.name !== 'AbortError') {

      // get the error message
      const cause = error.cause?.stack?.toString()?.toLowerCase() || ''
      const message = error.message.toLowerCase()

      // best case status is the http status code
      // if not we can try to find it in the message
      let status = error.status ?? error.status_code ?? 0
      if (status === 0) {
        // extract from message with \d\d\d
        const statusMatch = message.match(/\b(\d{3})\b/)
        if (statusMatch) {
          status = parseInt(statusMatch[0])
        }
      }

      // proxy
      if (!error.status && (cause.includes('proxy') || cause.includes('network'))) {
        console.error('Network error:', cause)
        response.setText(t('generator.errors.networkError', { error: error.message }))
        return 'error'
      }

      // missing api key
      else if ([401, 403].includes(status) || message.includes('401') || message.includes('apikey')) {
        console.error('Missing API key:', status, message)
        response.setText(t('generator.errors.missingApiKey', { error: error.message }))
        return 'missing_api_key'
      }

      // out of credits
      else if ([400, 402].includes(status) && (message.includes('credit') || message.includes('balance'))) {
        console.error('Out of credits:', status, message)
        response.setText(t('generator.errors.outOfCredits', { error: error.message }))
        return 'out_of_credits'

      // quota exceeded
      } else if ([413, 429].includes(status) && (message.includes('resource') || message.includes('quota') || message.includes('rate limit') || message.includes('too many') || message.includes('tokens per minute'))) {
        console.error('Quota exceeded:', status, message)
        response.setText(t('generator.errors.quotaExceeded', { error: error.message }))
        return 'quota_exceeded'

      // context length or function description too long
      } else if ([400, 429].includes(status) && (message.includes('context length') || message.includes('too long') || message.includes('too large'))) {
        if (message.includes('function.description')) {
          console.error('Function description too long:', status, message)
          response.setText(t('generator.errors.pluginDescriptionTooLong', { error: error.message }))
          return 'function_description_too_long'
        } else {
          console.error('Context too long:', status, message)
          response.setText(t('generator.errors.contextTooLong'))
          return 'context_too_long'
        }

      // function call not supported
      } else if ([400, 404].includes(status) && llm.plugins.length > 0 && (message.includes('function call') || message.includes('tools') || message.includes('tool calling') || message.includes('tool use') || message.includes('tool choice'))) {
        console.warn('Model does not support function calling:', status, message)
        llm.clearPlugins()
        return this.generate(llm, messages, opts, llmCallback)

      // streaming not supported
      } else if ([400].includes(status) && message.includes('\'stream\' does not support true')) {
        console.warn('Model does not support streaming:', status, message)
        return 'streaming_not_supported'

      // invalid model
      } else if ([404].includes(status) && message.includes('model')) {
        console.error('Provider reports invalid model:', status, message)
        response.setText(t('generator.errors.invalidModel', { error: error.message }))
        return 'invalid_model'

      // thinking cannot be disabled
      } else if ([400].includes(status) && message.includes('only works in thinking mode')) {
        console.error('Invalid budget:', status, message)
        response.setText(t('generator.errors.onlyThinkingMode', { error: error.message }))
        return 'invalid_budget'

      // invalid budget
      } else if ([400].includes(status) && message.includes('thinking budget')) {
        console.error('Invalid budget:', status, message)
        const match = message.match(/between (\d*) and (\d*)/)
        if (match) {
          const min = parseInt(match[1], 10)
          const max = parseInt(match[2], 10)
          response.setText(t('generator.errors.invalidBudgetKnown', { min, max }))
        } else {
          response.setText(t('generator.errors.invalidBudgetUnknown', { error: error.message }))
        }
        return 'invalid_budget'

      // final error: depends if we already have some content and if plugins are enabled
      } else {
        console.error('Error while generating text:', status, message)
        if (response.content === '') {
          if (opts?.contextWindowSize || opts?.maxTokens || opts?.temperature || opts?.top_k || opts?.top_p || Object.keys(opts?.customOpts || {}).length > 0) {
            response.setText(t('generator.errors.tryWithoutParams', { error: error.message }))
          } else if (llm.plugins.length > 0) {
            response.setText(t('generator.errors.tryWithoutPlugins', { error: error.message }))
          } else {
            response.setText(t('generator.errors.couldNotGenerate', { error: error.message }))
          }
        } else {
          response.appendText({ type: 'content', text: t('generator.errors.cannotContinue', { error: error.message }), done: true })
        }
        return 'error'
      }
    } else {
      llmCallback?.call(null, { type: 'content', text: null, done: true })
      return 'stopped'
    }
  }

  getConversation(messages: Message[]): Message[] {
    const conversationLength = this.config.llm.conversationLength
    const chatMessages = messages.filter((msg) => msg.role !== 'system')
    const conversation = [
      messages[0],
      ...chatMessages.slice(-conversationLength * 2, -1)
    ]
    for (const message of conversation) {
      for (const attachment of message.attachments) {
        if (attachment && !attachment.content) {
          attachment.loadContents()
        }
      }
    }
    return conversation
  }

}
