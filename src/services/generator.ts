import { LlmEngine, LlmCompletionOpts, LlmChunk, LlmResponse, Model } from 'multi-llm-ts'
import { Configuration, EngineConfig } from '../types/config'
import { DocRepoQueryResponseItem } from '../types/rag'
import { t , i18nInstructions, localeToLangName, getLlmLocale } from './i18n'
import Message from '../models/message'

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
  'function_description_too_long' |
  'function_call_not_supported' |
  'streaming_not_supported' |
  'error'

  export default class Generator {

  config: Configuration
  stopGeneration: boolean
  stream: AsyncIterable<LlmChunk>|null
  llm: LlmEngine|null

  static addCapabilitiesToSystemInstr = true
  static addDateAndTimeToSystemInstr = true

  constructor(config: Configuration) {
    this.config = config
    this.stream = null
    this.stopGeneration = false
    this.llm = null
  }

  async generate(llm: LlmEngine, messages: Message[], opts: GenerationOpts, llmCallback?: LlmChunkCallback): Promise<GenerationResult> {

    // return code
    let rc: GenerationResult = 'success'

    // get messages
    const response = messages[messages.length - 1]
    const conversation = this.getConversation(messages)

    // get the models
    const engineConfig: EngineConfig = this.config.engines[llm.getId()]
    const model = engineConfig?.models?.chat?.find((m: Model) => m.id === opts.model)
    const visionModel = engineConfig?.models?.chat?.find((m: Model) => m.id === engineConfig.model?.vision)
    if (!model) {
      console.error('Model not found:', llm.getName(), opts.model)
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
        this.stopGeneration = false
        this.stream = llm.generate(model, conversation, {
          visionFallbackModel: visionModel,
          usage: true,
          ...opts
        })
        for await (const msg of this.stream) {
          if (this.stopGeneration) {
            response.appendText({ type: 'content', text: '', done: true })
            rc = 'stopped'
            break
          }
          if (msg.type === 'usage') {
            response.usage = msg.usage
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
          response.setText(t('generator.errors.networkError'))
          rc = 'error'
        }
        
        // missing api key
        else if ([401, 403].includes(status) || message.includes('401') || message.includes('apikey')) {
          console.error('Missing API key:', status, message)
          response.setText(t('generator.errors.missingApiKey'))
          rc = 'missing_api_key'
        }
        
        // out of credits
        else if ([400, 402].includes(status) && (message.includes('credit') || message.includes('balance'))) {
          console.error('Out of credits:', status, message)
          response.setText(t('generator.errors.outOfCredits'))
          rc = 'out_of_credits'
        
        // quota exceeded
        } else if ([429].includes(status) && (message.includes('resource') || message.includes('quota') || message.includes('rate limit') || message.includes('too many'))) {
          console.error('Quota exceeded:', status, message)
          response.setText(t('generator.errors.quotaExceeded'))
          rc = 'quota_exceeded'

        // context length or function description too long
        } else if ([400, 429].includes(status) && (message.includes('context length') || message.includes('too long') || message.includes('too large'))) {
          if (message.includes('function.description')) {
            console.error('Function description too long:', status, message)
            response.setText(t('generator.errors.pluginDescriptionTooLong'))
            rc = 'function_description_too_long'
          } else {
            console.error('Context too long:', status, message)
            response.setText(t('generator.errors.contextTooLong'))
            rc = 'context_too_long'
          }
        
        // function call not supported
        } else if ([400, 404].includes(status) && llm.plugins.length > 0 && (message.includes('function call') || message.includes('tools') || message.includes('tool calling') || message.includes('tool use') || message.includes('tool choice'))) {
          console.warn('Model does not support function calling:', status, message)
          llm.clearPlugins()
          return this.generate(llm, messages, opts, llmCallback)

        // streaming not supported
        } else if ([400].includes(status) && message.includes('\'stream\' does not support true')) {
          console.warn('Model does not support streaming:', status, message)
          rc = 'streaming_not_supported'

        // invalid model
        } else if ([404].includes(status) && message.includes('model')) {
          console.error('Provider reports invalid model:', status, message)
          response.setText(t('generator.errors.invalidModel'))
          rc = 'invalid_model'

        // final error: depends if we already have some content and if plugins are enabled
        } else {
          console.error('Error while generating text:', status, message)
          if (response.content === '') {
            if (opts?.contextWindowSize || opts?.maxTokens || opts?.temperature || opts?.top_k || opts?.top_p || Object.keys(opts?.customOpts || {}).length > 0) {
              response.setText(t('generator.errors.tryWithoutParams'))
            } else if (llm.plugins.length > 0) {
              response.setText(t('generator.errors.tryWithoutPlugins'))
            } else {
              response.setText(t('generator.errors.couldNotGenerate'))
            }
          } else {
            response.appendText({ type: 'content', text: t('generator.errors.cannotContinue'), done: true })
          }
          rc = 'error'
        }
      } else {
        llmCallback?.call(null, { type: 'content', text: null, done: true })
      }
    }

    // make sure the message is terminated correctly
    // https://github.com/nbonamy/witsy/issues/104
    if (response.transient) {
      console.warn('Response is still transient. Appending empty text.')
      response.appendText({ type: 'content', text: '', done: true })
    }

    // cleanup
    this.stream = null
    //callback?.call(null, null)

    // done
    return rc

  }

  async stop() {
    if (this.stream) {
      this.stopGeneration = true
      try {
        await this.llm?.stop(this.stream)
      } catch { /* empty */ }
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

  getSystemInstructions(instructions?: string): string {

    // default
    let instr = instructions
    if (!instr) {
      // Check if it's a custom instruction
      const customInstruction = this.config.llm.customInstructions?.find((ci: any) => ci.id === this.config.llm.instructions)
      if (customInstruction) {
        instr = customInstruction.instructions
      } else {
        instr = i18nInstructions(this.config, `instructions.chat.${this.config.llm.instructions}`)
      }
    }

    // forced locale
    if (/*instr === i18nInstructions(null, `instructions.chat.${this.config.llm.instructions}`) && */this.config.llm.forceLocale) {
      const lang = localeToLangName(getLlmLocale())
      if (lang.length) {
        instr += '\n\n' + i18nInstructions(this.config, 'instructions.utils.setLang', { lang })
      }
    }

    // add info about capabilities
    if (Generator.addCapabilitiesToSystemInstr) {
      instr += '\n\nIf you output a Mermaid chart, it will be rendered as a diagram to the user.'
    }

    // add date and time
    if (Generator.addDateAndTimeToSystemInstr) {
      instr += '\n\n' + i18nInstructions(this.config, 'instructions.utils.setDate', { date: new Date().toLocaleString() })
    }

    // done
    return instr
  }

}
