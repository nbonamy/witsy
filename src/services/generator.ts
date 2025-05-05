import { LlmEngine, LlmCompletionOpts, LlmChunk, LlmResponse } from 'multi-llm-ts'
import { Configuration } from '../types/config'
import { DocRepoQueryResponseItem } from '../types/rag'
import { t, i18nInstructions, localeToLangName, getLlmLocale } from './i18n'
import Message from '../models/message'

// ---------------------------------------------------------------------------
// Monkey-patch LlmEngine.callTool so that an unknown tool does not throw and
// abort the entire generation. Instead we return a structured error object
// which will be forwarded back to the language model, enabling it to recover
// (e.g. by choosing a valid tool) without interrupting the conversation flow.
// ---------------------------------------------------------------------------

if (!(LlmEngine.prototype as any)._callToolPatched) {
  const originalCallTool = LlmEngine.prototype.callTool;

  // We mark the prototype so that we do the patch only once even if this file
  // is imported multiple times in the renderer.
  Object.defineProperty(LlmEngine.prototype, '_callToolPatched', {
    value: true,
    writable: false,
    enumerable: false,
  })

  LlmEngine.prototype.callTool = async function (this: LlmEngine, tool: string, args: any) {
    try {
      return await originalCallTool.call(this, tool, args)
    } catch (err: any) {
      const msg = err?.message || ''

      if (msg.startsWith('Tool ') && msg.endsWith(' not found')) {
        return { error: msg }
      }

      throw err
    }
  }
}

export interface GenerationOpts extends LlmCompletionOpts {
  model: string
  streaming?: boolean
  docrepo?: string
  sources?: boolean
}

export type GenerationResult = 
  'success' |
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

  static addDateAndTimeToSystemInstr = true

  constructor(config: Configuration) {
    this.config = config
    this.stream = null
    this.stopGeneration = false
    this.llm = null
  }

  async generate(llm: LlmEngine, messages: Message[], opts: GenerationOpts, callback?: (chunk: LlmChunk) => void): Promise<GenerationResult> {

    // return code
    let rc: GenerationResult = 'success'

    // get messages
    const response = messages[messages.length - 1]
    const conversation = this.getConversation(messages)

    try {

      // rag?
      let sources: DocRepoQueryResponseItem[] = [];
      if (opts.docrepo) {
        const userMessage = conversation[conversation.length - 1];
        sources = await window.api.docrepo.query(opts.docrepo, userMessage.content);
        //console.log('Sources', JSON.stringify(sources, null, 2));
        if (sources.length > 0) {
          const context = sources.map((source) => source.content).join('\n\n');
          const instructions = i18nInstructions(this.config, 'instructions.docquery')
          const prompt = instructions.replace('{context}', context).replace('{query}', userMessage.content);
          conversation[conversation.length - 1] = new Message('user', prompt);
        }
      }

      // debug
      //console.log(`Generation with ${llm.plugins.length} plugins and opts ${JSON.stringify(opts)}`)

      if (opts.streaming === false) {

        // normal completion
        const llmResponse: LlmResponse = await llm.complete(opts.model, conversation, {
          models: this.config.engines[llm.getName()]?.models?.chat,
          autoSwitchVision: this.config.llm.autoVisionSwitch,
          usage: true,
          ...opts
        })

        // fake streaming
        const chunk: LlmChunk = {
          type: 'content',
          text: llmResponse.content,
          done: true
        }

        // append text
        response.appendText(chunk)
        response.usage = llmResponse.usage
        callback?.call(null, chunk)

      } else {

        // now stream
        this.stopGeneration = false
        this.stream = await llm.generate(opts.model, conversation, {
          models: this.config.engines[llm.getName()]?.models?.chat,
          autoSwitchVision: this.config.llm.autoVisionSwitch,
          usage: true,
          ...opts
        })
        for await (const msg of this.stream) {
          if (this.stopGeneration) {
            response.appendText({ type: 'content', text: '', done: true })
            break
          }
          if (msg.type === 'usage') {
            response.usage = msg.usage
          } else if (msg.type === 'tool') {
            response.setToolCall(msg)
            callback?.call(null, msg)
          } else if (msg.type === 'content') {
            if (msg && sources && sources.length > 0) {
              msg.done = false
            }
            response.appendText(msg)
            callback?.call(null, msg)
          } else if (msg.type === 'reasoning') {
            response.appendText(msg)
            callback?.call(null, msg)
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
        callback?.call(null, { type: 'content', text: sourcesText, done: true })
      }

    } catch (error) {
      console.error('Error while generating text', error)
      if (error.name !== 'AbortError') {
        const message = error.message.toLowerCase()
        
        // missing api key
        if ([401, 403].includes(error.status) || message.includes('401') || message.includes('apikey')) {
          console.error('Missing API key:', error.status, message)
          response.setText(t('generator.errors.missingApiKey'))
          rc = 'missing_api_key'
        }
        
        // out of credits
        else if ([400, 402].includes(error.status) && (message.includes('credit') || message.includes('balance'))) {
          console.error('Out of credits:', error.status, message)
          response.setText(t('generator.errors.outOfCredits'))
          rc = 'out_of_credits'
        
        // quota exceeded
        } else if ([429].includes(error.status) && (message.includes('resource') || message.includes('quota') || message.includes('rate limit') || message.includes('too many'))) {
          console.error('Quota exceeded:', error.status, message)
          response.setText(t('generator.errors.quotaExceeded'))
          rc = 'quota_exceeded'

        // context length or function description too long
        } else if ([400, 429].includes(error.status) && (message.includes('context length') || message.includes('too long') || message.includes('too large'))) {
          if (message.includes('function.description')) {
            console.error('Function description too long:', error.status, message)
            response.setText(t('generator.errors.pluginDescriptionTooLong'))
            rc = 'function_description_too_long'
          } else {
            console.error('Context too long:', error.status, message)
            response.setText(t('generator.errors.contextTooLong'))
            rc = 'context_too_long'
          }
        
        // function call not supported
        } else if ([400, 404].includes(error.status) && llm.plugins.length > 0 && (message.includes('function call') || message.includes('tools') || message.includes('tool use') || message.includes('tool choice'))) {
          console.warn('Model does not support function calling:', error.status, message)
          llm.clearPlugins()
          return this.generate(llm, messages, opts, callback)

        // streaming not supported
        } else if ([400].includes(error.status) && message.includes('\'stream\' does not support true')) {
          console.warn('Model does not support streaming:', error.status, message)
          rc = 'streaming_not_supported'

        // invalid model
        } else if ([404].includes(error.status) && message.includes('model')) {
          console.error('Provider reports invalid model:', error.status, message)
          response.setText(t('generator.errors.invalidModel'))
          rc = 'invalid_model'

        // final error: depends if we already have some content and if plugins are enabled
        } else {
          console.error('Error while generating text:', error.status, error.message)
          if (response.content === '') {
            if (opts.contextWindowSize || opts.maxTokens || opts.temperature || opts.top_k || opts.top_p || Object.keys(opts.customOpts).length > 0) {
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
        callback?.call(null, { type: 'content', text: null, done: true })
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
      if (message.attachment && !message.attachment.content) {
        message.attachment.loadContents()
      }
    }
    return conversation
  }

  getSystemInstructions(instructions?: string): string {

    // default
    let instr = instructions || i18nInstructions(this.config, 'instructions.default')

    // forced locale
    if (instr === i18nInstructions(null, 'instructions.default') && this.config.llm.forceLocale) {
      const lang = localeToLangName(getLlmLocale())
      if (lang.length) {
        instr += ' ' + i18nInstructions(this.config, 'instructions.setLang', { lang })
      }
    }

    // // add date and time
    if (Generator.addDateAndTimeToSystemInstr) {
      instr += ' ' + i18nInstructions(this.config, 'instructions.setDate', { date: new Date().toLocaleString() })
    }

    // done
    return instr
  }

}
