
import { LlmEngine, LlmResponse, LlmChunk } from 'multi-llm-ts'
import { removeMarkdown } from '@excalidraw/markdown-to-text'
import { Configuration } from 'types/config'
import Chat from '../models/chat'
import Attachment from '../models/attachment'
import Message from '../models/message'
import LlmFactory from '../llms/llm'
import { availablePlugins } from '../plugins/plugins'
import Generator, { GenerationResult, GenerationOpts } from './generator'
import { Expert } from 'types'
import { expertI18n, i18nInstructions } from './i18n'

export interface AssistantCompletionOpts extends GenerationOpts {
  engine?: string
  titling?: boolean
  attachment?: Attachment
  expert?: Expert
  systemInstructions?: string
}

export default class extends Generator {

  llmFactory: LlmFactory
  chat: Chat

  constructor(config: Configuration) {
    super(config)
    this.llm = null
    this.stream = null
    this.llmFactory = new LlmFactory(config)
    this.chat = new Chat()
  }

  setChat(chat: Chat) {
    this.chat = chat
  }

  initChat(): Chat {
    this.chat = new Chat()
    return this.chat
  }

  resetLlm() {
    this.llm = null
  }

  initLlm(engine: string): void {
    
    // same?
    if (this.llm !== null && this.llm.getName() === engine) {
      return
    }

    // switch
    const llm = this.llmFactory.igniteEngine(engine)
    this.setLlm(llm)
  }

  setLlm(llm: LlmEngine) {
    this.llm = llm
  }

  hasLlm() {
    return this.llm !== null
  }

  async prompt(prompt: string, opts: AssistantCompletionOpts, callback: (chunk: LlmChunk) => void, beforeTitleCallback?: () => void): Promise<void> {

    // check
    prompt = prompt.trim()
    if (prompt === '') {
      return null
    }

    // merge with defaults
    const defaults: AssistantCompletionOpts = {
      titling: true,
      ... this.llmFactory.getChatEngineModel(),
      attachment: null,
      docrepo: null,
      expert: null,
      sources: true,
      //systemInstructions: i18nInstructions(this.config, 'instructions.default'),
      citations: true,
    }
    opts = {...defaults, ...opts }

    // we need a chat
    if (this.chat === null) {
      this.initChat()
    }

    // we need messages
    if (this.chat.messages.length === 0) {
      this.chat.addMessage(new Message('system', this.getSystemInstructions(opts.systemInstructions)))
    }

    // make sure we have the right engine and model
    // special case: chat was started without an apiKey
    // so engine and model are null so we need to keep opts ones...
    opts.engine = this.chat.engine || opts.engine
    opts.model = this.chat.model || opts.model
    opts.docrepo = this.chat.docrepo || opts.docrepo

    // make sure chat options are set
    this.chat.setEngineModel(opts.engine, opts.model)
    this.chat.docrepo = opts.docrepo

    // we need an llm
    this.initLlm(opts.engine)
    if (this.llm === null) {
      return null
    }

    // make sure llm has latest tools
    this.llm.clearPlugins()
    if (!this.chat.disableTools) {
      for (const pluginName in availablePlugins) {
        const pluginClass = availablePlugins[pluginName]
        const instance = new pluginClass(this.config.plugins[pluginName])
        this.llm.addPlugin(instance)
      }
    }

    // add user message
    const userMessage = new Message('user', prompt)
    userMessage.setExpert(opts.expert, expertI18n(opts.expert, 'prompt'))
    userMessage.engine = opts.engine
    userMessage.model = opts.model
    userMessage.attach(opts.attachment)
    this.chat.addMessage(userMessage)

    // add assistant message
    const assistantMessage = new Message('assistant')
    assistantMessage.engine = opts.engine
    assistantMessage.model = opts.model
    this.chat.addMessage(assistantMessage)
    callback?.call(null, null)

    // generate text
    const hadPlugins = this.llm.plugins.length > 0
    let rc: GenerationResult = await this._prompt(opts, callback)

    // check if streaming is not supported
    if (rc === 'streaming_not_supported') {
      this.chat.disableStreaming = true
      rc = await this._prompt(opts, callback)
    }

    // titling
    if (rc !== 'success') {
      opts.titling = false
    }

    // check if generator disabled plugins
    if (hadPlugins && this.llm.plugins.length === 0) {
      this.chat.disableTools = true
    }

    // check if we need to update title
    if (opts.titling && !this.chat.hasTitle()) {
      beforeTitleCallback?.call(null)
      this.chat.title = await this.getTitle() || this.chat.title
    }
  
  }

  async _prompt(opts: AssistantCompletionOpts, callback: (chunk: LlmChunk) => void): Promise<GenerationResult> {

    // normal case: we stream
    if (!this.chat.disableStreaming) {
      return await this.generate(this.llm, this.chat.messages, {
        ...opts,
        ...this.chat.modelOpts,
      }, callback)
    }

    try {

      // normal completion
      const response: LlmResponse = await this.llm.complete(this.chat.model, this.chat.messages, {
        usage: true,
        ...opts,
        ...this.chat.modelOpts
      })

      // fake streaming
      const chunk: LlmChunk = {
        type: 'content',
        text: response.content,
        done: true
      }

      // add content
      this.chat.lastMessage().appendText(chunk)
      this.chat.lastMessage().usage = response.usage
      callback.call(null, chunk)

      // done
      return 'success'

    } catch (error) {
      console.error('Error while trying to complete', error)
      return 'error'
    }

  }

  async attach(file: Attachment) {

    // make sure last message is from user else create it
    if (this.chat.lastMessage()?.role !== 'user') {
      this.chat.addMessage(new Message('user', ''))
    }

    // now attach
    this.chat.lastMessage().attach(file)

  }

  async getTitle() {

    try {

      // build messages
      const messages = [
        new Message('system', i18nInstructions(this.config, 'instructions.titling')),
        this.chat.messages[1],
        this.chat.messages[2],
        new Message('user', i18nInstructions(this.config, 'instructions.titling_user'))
      ]

      // now get it
      this.initLlm(this.chat.engine)
      const response = await this.llm.complete(this.chat.model, messages)
      let title = response.content.trim()
      if (title === '') {
        return this.chat.messages[1].content
      }

      // ollama reasoning removal: everything between <think> and </think>
      title = title.replace(/<think>[\s\S]*?<\/think>/g, '')

      // remove html tags
      title = title.replace(/<[^>]*>/g, '')

      // and markdown
      title = removeMarkdown(title)

      // remove prefixes
      if (title.startsWith('Title:')) {
        title = title.substring(6)
      }

      // remove quotes
      if (title.startsWith('"') && title.endsWith('"')) {
        title = title.substring(1, title.length - 1)
      }
      
      // done
      return title

    } catch (error) {
      console.error('Error while trying to get title', error)
      return null
    }
  
  }

}
