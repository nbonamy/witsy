
import { ipcRenderer } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import Chat from '../models/chat'
import Message from '../models/message'
import OpenAI from '../services/openai'
import Ollama from '../services/ollama'
import { store } from '../services/store'

export default class {

  constructor(config) {
    this.config = config
    this.llm = null
    this.chat = null
    this.stream = null
    this.newChat()
  }

  newChat(title) {

    // select last chat
    if (store.chats.length > 0) {
      this.chat = store.chats[store.chats.length - 1]
    }

    // now check
    if (this.chat === null || this.chat.messages.length > 1) { 
      this.chat = new Chat(title)
      this.chat.addMessage(new Message('system', this.config.instructions.default))
      store.chats.push(this.chat)
      store.save()
    }
  }

  setChat(chat) {
    this.chat = chat
  }

  initLlm() {
    if (store.config.llm.engine === 'ollama') {
    this.llm = new Ollama(this.config)
    } else if (store.config.openai.apiKey) {
      this.llm = new OpenAI(this.config)
    } else {
      this.llm = null
    }
    return this.llm
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

  async prompt(prompt, callback) {

    // check
    prompt = prompt.trim()
    if (prompt === '') {
      return
    }

    // we need an llm
    if (this.llm === null) {
      if (this.initLlm() === null) {
        return
      }
    }

    // set engine and model
    if (this.chat.engine === null) {
      let engine = store.config.llm.engine
      let model = store.config.getActiveModel()
      this.chat.setEngineModel(engine, model)
    }

    // add message
    let message = new Message('user', prompt)
    this.chat.addMessage(message)
    store.cleanEmptyChats()

    // add assistant message
    this.chat.addMessage(new Message('assistant'))
    this.chat.lastMessage().setText(null)
    if (callback) callback()

    // route
    let route = await this.route(prompt)
    if (route === 'IMAGE') {
      await this.generateImage(prompt, callback)
    } else {
      await this.generateText(prompt, callback)
    }

    // check if we need to update title
    if (this.chat.messages.filter((msg) => msg.role === 'assistant').length === 1) {
      this.chat.setTitle(await this.getTitle())
    }
  
    // save
    store.save()

  }

  async generateText(prompt, callback) {

    try {

      this.stream = await this.llm.stream(this._getRelevantChatMessages())
      for await (let chunk of this.stream) {
        const { text, done } = this.llm.processChunk(chunk)
        this.chat.lastMessage().appendText(text, done)
        if (callback) callback(text)
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error)
        this.chat.lastMessage().setText('Sorry, I could not generate text for that prompt.')
      }
    }

    // cleanup
    this.stream = null
    if (callback) callback(null)
  
  }

  async generateImage(prompt, callback) {

    try {

      // generate 
      let response = await this.llm.image(prompt)

      // we need to download it locally
      let filename = `${uuidv4()}.png`
      filename = ipcRenderer.sendSync('download', {
        url: response.url,
        properties: {
          filename: filename,
          directory: 'userData',
          subdir: 'images',
          prompt: false
        }
      })

      // save
      filename = `file://${filename}`
      this.chat.lastMessage().setImage(filename)
      if (callback) callback(filename)

    } catch (error) {
      console.error(error)
      this.chat.lastMessage().setText('Sorry, I could not generate an image for that prompt.')
      if (callback) callback(null)
    }

  }

  async stop() {
    if (this.stream) {
      await this.llm?.stop(this.stream)
      this.chat.lastMessage().appendText(null, true)
    }
  }

  async getTitle() {

    // build messages
    let messages = [
      new Message('system', this.config.instructions.titling),
      this.chat.messages[1],
      this.chat.messages[2]
    ]

    // now get it
    let response = await this.llm.complete(messages)
    let title = response.content.trim()
    if (title === '') {
      return this.chat.messages[1].content
    }

    // now clean up
    if (title.startsWith('Title:')) {
      title = title.substring(6)
    }

    // remove quotes
    title.trim().replace(/^"|"$/g, '').trim()

    // take only up to 80 words
    const words = title.split(' ')
    title = ''
    for (const word of words) {
      if (title.length + word.length < 80) {
        title += word + ' '
      } else {
        title = title.slice(0, -1) + '...'
        break
      }
    }

    // done
    return title
  }

  _getRelevantChatMessages() {
    const relevantMessagesCount = 5
    let chatMessages = this.chat.messages.filter((msg) => msg.role !== 'system')
    let messages = [this.chat.messages[0], ...chatMessages.slice(-relevantMessagesCount-1, -1)]
    return messages
  }

}
