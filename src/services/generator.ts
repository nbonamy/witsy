import { LlmEngine, LlmCompletionOpts, LlmChunk } from 'multi-llm-ts'
import { Configuration } from '../types/config'
import { DocRepoQueryResponseItem } from '../types/rag'
import { t , i18nInstructions, localeToLangName } from './i18n'
import Message from '../models/message'

export interface GenerationOpts extends LlmCompletionOpts {
  model: string
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
          const prompt = i18nInstructions(this.config, 'instructions.docquery').replace('{context}', context).replace('{query}', userMessage.content);
          conversation[conversation.length - 1] = new Message('user', prompt);
        }
      }

      // debug
      //console.log(`Generation with ${llm.plugins.length} plugins and opts ${JSON.stringify(opts)}`)

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
          response.setText(t('generator.errors.missingApiKey'))
          rc = 'missing_api_key'
        }
        
        // out of credits
        else if ([400, 402].includes(error.status) && (message.includes('credit') || message.includes('balance'))) {
          response.setText(t('generator.errors.outOfCredits'))
          rc = 'out_of_credits'
        
        // quota exceeded
        } else if ([429].includes(error.status) && (message.includes('resource') || message.includes('quota') || message.includes('too many'))) {
          response.setText(t('generator.errors.quotaExceeded'))
          rc = 'quota_exceeded'

        // context length or function description too long
        } else if ([400].includes(error.status) && (message.includes('context length') || message.includes('too long'))) {
          if (message.includes('function.description')) {
            response.setText(t('generator.errors.pluginDescriptionTooLong'))
            rc = 'function_description_too_long'
          } else {
            response.setText(t('generator.errors.contextTooLong'))
            rc = 'context_too_long'
          }
        
        // function call not supported
        } else if ([400, 404].includes(error.status) && llm.plugins.length > 0 && (message.includes('function call') || message.includes('tools') || message.includes('tool use') || message.includes('tool choice'))) {
          console.log('Model does not support function calling: removing tool and retrying')
          llm.clearPlugins()
          return this.generate(llm, messages, opts, callback)

        // streaming not supported
        } else if ([400].includes(error.status) && message.includes('\'stream\' does not support true')) {
          rc = 'streaming_not_supported'

        // invalid model
        } else if ([404].includes(error.status) && message.includes('model')) {
          response.setText(t('generator.errors.invalidModel'))
          rc = 'invalid_model'

        // final error: depends if we already have some content and if plugins are enabled
        } else {
          if (response.content === '') {
            if (opts.contextWindowSize || opts.maxTokens || opts.temperature || opts.top_k || opts.top_p) {
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
      new Message('system', this.patchSystemInstructions(messages[0].content)),
      ...chatMessages.slice(-conversationLength * 2, -1)
    ]
    for (const message of conversation) {
      if (message.attachment && !message.attachment.content) {
        message.attachment.loadContents()
      }
    }
    return conversation
  }

  getSystemInstructions(instructions?: string) {

    // default
    let instr = instructions || i18nInstructions(this.config, 'instructions.default')

    // forced locale
    if (instr === i18nInstructions(null, 'instructions.default') && this.config.llm.forceLocale) {
      const lang = localeToLangName(this.config.llm.locale)
      if (lang.length) {
        instr += ' ' + i18nInstructions(this.config, 'instructions.setlang', { lang })
      }
    }

    // // add date and time
    // if (Generator.addDateAndTimeToSystemInstr) {
    //   instr += ' Current date and time is ' + new Date().toLocaleString() + '.'
    // }

    // done
    return instr
  }

  patchSystemInstructions(instructions: string) {
    return instructions.replace(/Current date and time is [^.]+/, 'Current date and time is ' + new Date().toLocaleString())
  }

}
