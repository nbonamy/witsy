
import { Attachment, LlmChunk, LlmCompletionOpts } from '../index.d'
import { Configuration } from '../config.d'
import Chat from '../models/chat'
import Message from '../models/message'
import LlmEngine from './engine'
import OpenAI from './openai'
import Ollama from './ollama'
import MistralAI from './mistralai'
import Anthropic from './anthropic'
import { store } from './store'
import { download, saveFileContents } from './download'
import { countryCodeToName } from './i18n'

export default class {

  config: Configuration
  engine: string
  llm: LlmEngine
  chat: Chat
  stream: any

  constructor(config: Configuration) {
    this.config = config
    this.engine = null
    this.llm = null
    this.chat = null
    this.stream = null
  }

  setChat(chat: Chat) {
    this.chat = chat
  }

  initLlm(engine: string): void {
    
    // same?
    if (this.engine === engine && this.llm !== null) {
      return
    }

    // switch
    if (engine === 'ollama') {
      this.setLlm(engine, new Ollama(this.config))
    } else if (engine === 'anthropic') {
      this.setLlm(engine, new Anthropic(this.config))
    } else if (engine === 'mistralai') {
      this.setLlm(engine, new MistralAI(this.config))
    } else if (store.config.engines.openai.apiKey) {
      this.setLlm(engine, new OpenAI(this.config))
    } else {
      this.setLlm(null, null)
    }
  }

  setLlm(engine: string, llm: LlmEngine) {
    this.engine = engine
    this.llm = llm
  }

  hasLlm() {
    return this.llm !== null
  }

  async route(prompt: string) {
    
    // check if routing possibble
    const routingModel = this.llm.getRountingModel()
    if (routingModel === null) {
      return null
    }
    
    // build messages
    const messages = [
      new Message('system', this.config.instructions.routing),
      new Message('user', prompt)
    ]

    // now get it
    const route = await this.llm.complete(messages, { model: routingModel })
    return route.content
  }

  async prompt(prompt: string, opts: LlmCompletionOpts, callback: (chunk: LlmChunk) => void): Promise<void> {

    // check
    prompt = prompt.trim()
    if (prompt === '') {
      return null
    }

    // engine and model
    let engine = opts.engine || store.config.llm.engine
    let model = opts.model || store.config.getActiveModel()

    // save histore
    const save = opts.save == null || opts.save !== false

    // we need a chat
    if (this.chat === null) {
      this.chat = new Chat()
      this.chat.setEngineModel(engine, model)
      this.chat.addMessage(new Message('system', this.getLocalizedInstructions(this.config.instructions.default)))
      if (save) {
        store.chats.push(this.chat)
        store.saveHistory()
      }
    } else {
      // make sure we have the right engine and model
      engine = this.chat.engine
      model = this.chat.model
      opts.model = model
    }

    // we need an llm
    this.initLlm(engine)
    if (this.llm === null) {
      return null
    }

    // make sure llm has latest tools
    this.llm.loadPlugins()

    // add message
    const message = new Message('user', prompt)
    message.attachFile(opts.attachment)
    this.chat.addMessage(message)

    // add assistant message
    this.chat.addMessage(new Message('assistant'))
    this.chat.lastMessage().setText(null)
    callback?.call(null, null)

    // route
    let route = null
    if (opts.route == null || opts.route !== false) {
      route = await this.route(prompt)
    }
    if (route === 'IMAGE') {
      await this.generateImage(prompt, opts, callback)
    } else {
      await this.generateText(opts, callback)
    }

    // check if we need to update title
    if (this.chat.messages.filter((msg) => msg.role === 'assistant').length === 1) {
      this.chat.title = await this.getTitle();
    }
  
    // save
    if (save) {
      store.saveHistory()
    }

  }

  async generateText(opts: LlmCompletionOpts, callback: (chunk: LlmChunk) => void): Promise<void> {

    // we need this to be const during generation
    const llm = this.llm
    const message = this.chat.lastMessage()

    try {

      this.stream = await llm.stream(this.getRelevantChatMessages(), opts)
      while (this.stream) {
        let newStream = null
        for await (const streamChunk of this.stream) {
          const chunk: LlmChunk = await llm.streamChunkToLlmChunk(streamChunk)
          if (chunk?.stream) {
            newStream = chunk.stream
          } else {
            message.appendText(chunk)
            callback?.call(null, chunk)
          }
        }
        this.stream = newStream
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error)
        message.setText('Sorry, I could not generate text for that prompt.')
      }
    }

    // cleanup
    this.stream = null
    //callback?.call(null, null)
  
  }

  async generateImage(prompt: string, opts: LlmCompletionOpts, callback: (chunk: LlmChunk) => void): Promise<void> {

    // we need this to be const during generation
    const llm = this.llm
    const message = this.chat.lastMessage()

    try {

      // generate 
      const response = await llm.image(prompt, opts)

      // we need to download/write it locally
      let filename = null
      if (response.url) {
        filename = download(response.url)
      } else if (response.content) {
        filename = saveFileContents('png', response.content)
      }
      if (!filename) {
        throw new Error('Could not save image')
      }

      // save
      message.setImage(`file://${filename}`)
      callback?.call(null, {
        text: filename,
        done: true
      })

    } catch (error) {
      console.error(error)
      message.setText('Sorry, I could not generate an image for that prompt.')
      callback?.call(null, null)
    }

  }

  async stop() {
    if (this.stream) {
      await this.llm?.stop(this.stream)
      this.chat.lastMessage().appendText({ text: null, done: true})
    }
  }

  async attach(file: Attachment) {

    // make sure last message is from user else create it
    if (this.chat.lastMessage()?.role !== 'user') {
      this.chat.addMessage(new Message('user'))
    }

    // now attach
    this.chat.lastMessage().attachFile(file)

  }

  async getTitle() {

    // build messages
    const messages = [
      new Message('system', this.getLocalizedInstructions(this.config.instructions.titling)),
      this.chat.messages[1],
      this.chat.messages[2],
      new Message('user', this.config.instructions.titling_user)
    ]

    // now get it
    this.initLlm(this.chat.engine)
    const response = await this.llm.complete(messages, { model: this.chat.model })
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
  }

  getRelevantChatMessages() {
    const conversationLength = this.config.llm.conversationLength
    const chatMessages = this.chat.messages.filter((msg) => msg.role !== 'system')
    const messages = [this.chat.messages[0], ...chatMessages.slice(-conversationLength*2, -1)]
    return messages
  }

  getLocalizedInstructions(instructions: string) {
    const instr = instructions
    if (!this.config.general.language) return instr
    return instr + ' Always answer in ' + countryCodeToName(this.config.general.language) + '.'
  }

}
