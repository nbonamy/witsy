
import Chat from '../models/chat'
import Message from '../models/message'
import OpenAI from '../services/openai'
import Ollama from '../services/ollama'
import { store } from '../services/store'
import { download } from '../services/download'

export default class {

  constructor(config) {
    this.config = config
    this.llm = null
    this.chat = null
    this.stream = null
    this.newChat()
  }

  newChat(save = true) {

    // select last chat
    this.chat = null
    if (save) {
      if (store.chats.length > 0) {
        this.chat = store.chats[store.chats.length - 1]
      }
    }

    // now check
    if (this.chat === null || this.chat.messages.length > 1) { 
      this.chat = new Chat()
      this.chat.addMessage(new Message('system', this.config.instructions.default))
      if (save) {
        store.chats.push(this.chat)
        store.save()
      }
    }
  }

  setChat(chat) {
    this.chat = chat
  }

  initLlm(engine) {
    if (engine === 'ollama') {
      return new Ollama(this.config)
    } else if (store.config.openai.apiKey) {
      return new OpenAI(this.config)
    } else {
      return null
    }
  }

  hasLlm() {
    return this.llm !== null
  }

  async route(prompt) {
    
    // check if routing possibble
    let routingModel = this.llm.getRountingModel()
    if (routingModel === null) {
      return null
    }
    
    // build messages
    let messages = [
      new Message('system', this.config.instructions.routing),
      new Message('user', prompt)
    ]

    // now get it
    let route = await this.llm.complete(messages, { model: routingModel })
    return route.content
  }

  async prompt(prompt, opts, callback) {

    // check
    prompt = prompt.trim()
    if (prompt === '') {
      return
    }

    // set engine and model
    let engine = opts.engine || store.config.llm.engine
    let model = opts.model || store.config.getActiveModel()
    if (this.chat.engine === null) {
      this.chat.setEngineModel(engine, model)
    } else {
      engine = this.chat.engine
      model = this.chat.model
      opts.model = model
    }

    // we need an llm
    this.llm = this.initLlm(engine)
    if (this.llm === null) {
      return
    }

    // add message
    let message = new Message('user', prompt)
    message.attachFile(opts.attachment)
    this.chat.addMessage(message)

    // add assistant message
    this.chat.addMessage(new Message('assistant'))
    this.chat.lastMessage().setText(null)
    callback?.call(null)

    // route
    let route = await this.route(prompt)
    if (route === 'IMAGE') {
      await this.generateImage(prompt, opts, callback)
    } else {
      await this.generateText(prompt, opts, callback)
    }

    // check if we need to update title
    if (this.chat.messages.filter((msg) => msg.role === 'assistant').length === 1) {
      this.chat.title = await this.getTitle();
    }
  
    // save
    store.save()

  }

  async generateText(prompt, opts, callback) {

    try {

      this.stream = await this.llm.stream(this._getRelevantChatMessages(), opts)
      for await (let chunk of this.stream) {
        const { text, done } = this.llm.processChunk(chunk)
        this.chat.lastMessage().appendText(text, done)
        callback?.call(text)
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error)
        this.chat.lastMessage().setText('Sorry, I could not generate text for that prompt.')
      }
    }

    // cleanup
    this.stream = null
    callback?.call(null)
  
  }

  async generateImage(prompt, opts, callback) {

    try {

      // generate 
      let response = await this.llm.image(prompt, opts)

      // we need to download it locally
      let filename = download(response.url)
      filename = `file://${filename}`

      // ssve
      this.chat.lastMessage().setImage(filename)
      callback?.call(filename)

    } catch (error) {
      console.error(error)
      this.chat.lastMessage().setText('Sorry, I could not generate an image for that prompt.')
      callback?.call(null)
    }

  }

  async stop() {
    if (this.stream) {
      await this.llm?.stop(this.stream)
      this.chat.lastMessage().appendText(null, true)
    }
  }

  async attach(file) {

    // make sure last message is from user else create it
    if (this.chat.lastMessage().role !== 'user') {
      this.chat.addMessage(new Message('user'), '')
    }

    // now attach
    this.chat.lastMessage().attachFile(file)

  }

  async getTitle() {

    // build messages
    let messages = [
      new Message('system', this.config.instructions.titling),
      this.chat.messages[1],
      this.chat.messages[2]
    ]

    // now get it
    this.llm = this.initLlm(this.chat.engine)
    let response = await this.llm.complete(messages, { model: this.chat.model })
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

  _getRelevantChatMessages() {
    const conversationLength = this.config.llm.conversationLength
    let chatMessages = this.chat.messages.filter((msg) => msg.role !== 'system')
    let messages = [this.chat.messages[0], ...chatMessages.slice(-conversationLength-1, -1)]
    return messages
  }

}
