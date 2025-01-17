
import { LlmEngine, type LlmChunk } from 'multi-llm-ts'
import { Configuration } from 'types/config'
import Chat, { defaultTitle } from '../models/chat'
import Attachment from '../models/attachment'
import Message from '../models/message'
import LlmFactory from '../llms/llm'
import { store } from './store'
import { availablePlugins } from '../plugins/plugins'
import Generator, { type GenerationOpts } from './generator'
import { Expert } from 'types'

export interface AssistantCompletionOpts extends GenerationOpts {
  engine?: string
  save?: boolean
  titling?: boolean
  disableTools?: boolean
  overwriteEngineModel?: boolean
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
    this.chat = null
    this.stream = null
    this.llmFactory = new LlmFactory(config)
  }

  setChat(chat: Chat) {
    this.chat = chat
  }

  initChat(instructions?: string): Chat {
    this.chat = new Chat()
    this.chat.addMessage(new Message('system', this.getSystemInstructions(instructions)))
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

  async prompt(prompt: string, opts: AssistantCompletionOpts, callback: (chunk: LlmChunk) => void): Promise<void> {

    // check
    prompt = prompt.trim()
    if (prompt === '') {
      return null
    }

    // merge with defaults
    const defaults: AssistantCompletionOpts = {
      save: true,
      titling: true,
      ... this.llmFactory.getChatEngineModel(),
      attachment: null,
      docrepo: null,
      expert: null,
      sources: true,
      overwriteEngineModel: false,
      systemInstructions: this.config.instructions.default,
    }
    opts = {...defaults, ...opts }

    // we need a chat
    if (this.chat === null) {

      // initialize the chat
      this.initChat(opts.systemInstructions)
      
      // save
      if (opts.save) {
        store.history.chats.push(this.chat)
        //store.saveHistory()
      }
    
    } else if (!opts.overwriteEngineModel) {
      // make sure we have the right engine and model
      // special case: chat was started without an apiKey
      // so engine and model are null so we need to keep opts ones...
      opts.engine = this.chat.engine || opts.engine
      opts.model = this.chat.model || opts.model
      opts.docrepo = this.chat.docrepo || opts.docrepo
    }

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
    if (!opts.disableTools && !this.chat.disableTools) {
      for (const pluginName in availablePlugins) {
        const pluginClass = availablePlugins[pluginName]
        const instance = new pluginClass(this.config.plugins[pluginName])
        this.llm.addPlugin(instance)
      }
    }

    // add message
    const message = new Message('user', prompt)
    message.expert = opts.expert
    message.attach(opts.attachment)
    this.chat.addMessage(message)

    // add assistant message
    this.chat.addMessage(new Message('assistant'))
    callback?.call(null, null)

    // generate text
    const hadPlugins = this.llm.plugins.length > 0
    const rc = await this.generate(this.llm, this.chat.messages, opts, callback)
    if (!rc) {
      opts.titling = false
    }

    // check if generator disabled plugins
    if (hadPlugins && this.llm.plugins.length === 0) {
      this.chat.disableTools = true
    }

    // check if we need to update title
    if (opts.titling && this.chat.title === defaultTitle) {
      this.chat.title = await this.getTitle() || this.chat.title
    }
  
    // save
    if (opts.save) {
      store.saveHistory()
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
        new Message('system', this.getSystemInstructions(this.config.instructions.titling)),
        this.chat.messages[1],
        this.chat.messages[2],
        new Message('user', this.config.instructions.titling_user)
      ]

      // now get it
      this.initLlm(this.chat.engine)
      const response = await this.llm.complete(this.chat.model, messages)
      let title = response.content.trim()
      if (title === '') {
        return this.chat.messages[1].content
      }

      // now clean up
      if (title.startsWith('Title:')) {
        title = title.substring(6)
      }

      // remove quotes
      title = title.trim().replace(/^"|"$/g, '').trim()

      // done
      return title

    } catch (error) {
      console.error('Error while trying to get title', error)
      return null
    }
  
  }

}
