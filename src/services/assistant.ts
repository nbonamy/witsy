import { Attachment } from 'types/index.d'
import { LlmCompletionOpts, LlmChunk, LlmEvent } from 'types/llm.d'
import { Configuration } from 'types/config.d'
import { DocRepoQueryResponseItem } from 'types/rag.d'
import Chat from '../models/chat'
import Message from '../models/message'
import LlmEngine from './engine'
import { store } from './store'
import { igniteEngine } from './llm'
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

  setConfig(config: Configuration) {
    this.config = config
  }

  setChat(chat: Chat) {
    this.chat = chat
  }

  resetLlm() {
    this.engine = null
    this.llm = null
  }

  initLlm(engine: string): void {
    
    // same?
    if (this.engine === engine && this.llm !== null) {
      return
    }

    // switch
    const llm = igniteEngine(engine, this.config)
    this.setLlm(llm ? engine : null, llm)
  }

  setLlm(engine: string, llm: LlmEngine) {
    this.engine = engine
    this.llm = llm
  }

  hasLlm() {
    return this.llm !== null
  }

  async prompt(prompt: string, opts: LlmCompletionOpts, callback: (chunk: LlmChunk) => void): Promise<void> {

    // check
    prompt = prompt.trim()
    if (prompt === '') {
      return null
    }

    // merge with defaults
    const defaults: LlmCompletionOpts = {
      save: true,
      titling: true,
      engine: store.config.llm.engine,
      model: store.config.getActiveModel(),
      overwriteEngineModel: false,
      systemInstructions: this.config.instructions.default,
    }
    opts = {...defaults, ...opts }

    // we need a chat
    if (this.chat === null) {

      // system instructions
      const systemPrompt = opts.systemInstructions || this.config.instructions.default

      // initialize the chat
      this.chat = new Chat()
      this.chat.docrepo = opts.docrepo
      this.chat.setEngineModel(opts.engine, opts.model)
      this.chat.addMessage(new Message('system', this.getLocalizedInstructions(systemPrompt)))
      
      // save
      if (opts.save) {
        store.chats.push(this.chat)
        store.saveHistory()
      }
    
    } else if (!opts.overwriteEngineModel) {
      // make sure we have the right engine and model
      // special case: chat was started without an apiKey
      // so engine and model are null so we need to keep opts ones...
      opts.engine = this.chat.engine || opts.engine
      opts.model = this.chat.model || opts.model
    }

    // we need an llm
    this.initLlm(opts.engine)
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

    // generate text
    await this.generateText(opts, callback)

    // check if we need to update title
    if (opts.titling && this.chat.messages.filter((msg) => msg.role === 'assistant').length === 1) {
      this.chat.title = await this.getTitle() || this.chat.title
    }
  
    // save
    if (opts.save) {
      store.saveHistory()
    }

  }

  async generateText(opts: LlmCompletionOpts, callback: (chunk: LlmChunk) => void): Promise<void> {

    // we need this to be const during generation
    const llm = this.llm
    const message: Message = this.chat.lastMessage()

    try {

      // get messages
      const messages = this.getRelevantChatMessages()

      // rag?
      let sources: DocRepoQueryResponseItem[] = [];
      if (this.chat.docrepo) {
        const userMessage = messages[messages.length - 1];
        sources = await window.api.docrepo.query(this.chat.docrepo, userMessage.content);
        //console.log('Sources', JSON.stringify(sources, null, 2));
        if (sources.length > 0) {
          const context = sources.map((source) => source.content).join('\n\n');
          const prompt = this.config.instructions.docquery.replace('{context}', context).replace('{query}', userMessage.content);
          messages[messages.length - 1] = new Message('user', prompt);
        }
      }

      // now stream
      this.stream = await llm.stream(messages, opts)
      while (this.stream) {
        let newStream = null
        for await (const streamChunk of this.stream) {
          const chunk: LlmChunk = await llm.streamChunkToLlmChunk(streamChunk, (event: LlmEvent) => {
            if (event.type === 'stream') {
              newStream = event.content
            } else  if (event.type === 'tool') {
              message.setToolCall(event.content)
            }
          })
          if (chunk && sources && sources.length > 0) {
            chunk.done = false
          }
          message.appendText(chunk)
          callback?.call(null, chunk)
        }
        this.stream = newStream
      }

      // append sources
      if (sources && sources.length > 0) {
        
        // reduce to unique sources based on metadata.id
        const uniqueSourcesMap = new Map();
        sources.forEach(source => {
          uniqueSourcesMap.set(source.metadata.uuid, source);
        })
        sources = Array.from(uniqueSourcesMap.values());

        // now add them
        let sourcesText = '\n\nSources:\n\n'
        sourcesText += sources.map((source) => `- [${source.metadata.title}](${source.metadata.url})`).join('\n')
        message.appendText({ text: sourcesText, done: true })
        callback?.call(null, { text: sourcesText, done: true })
      }

    } catch (error) {
      console.error('Error while generating text', error)
      if (error.name !== 'AbortError') {
        if (error.status === 401 || error.message.includes('401') || error.message.toLowerCase().includes('apikey')) {
          message.setText('You need to enter your API key in the Models tab of <a href="#settings_models">Settings</a> in order to chat.')
          opts.titling = false
          this.chat.setEngineModel(null, null)
          this.resetLlm()
        } else if (error.status === 400 && (error.message.includes('credit') || error.message.includes('balance'))) {
          message.setText('Sorry, it seems you have run out of credits. Check the balance of your LLM provider account.')
          opts.titling = false
        } else if (message.content === '') {
          message.setText('Sorry, I could not generate text for that prompt.')
          opts.titling = false
        } else {
          message.appendText({ text: '\n\nSorry, I am not able to continue here.', done: true })
          opts.titling = false
        }
      } else {
        callback?.call(null, { text: null, done: true })
      }
    }

    // cleanup
    this.stream = null
    //callback?.call(null, null)
  
  }

  async stop() {
    if (this.stream) {
      await this.llm?.stop(this.stream)
      this.chat.lastMessage().appendText({ text: null, done: true })
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

    try {

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

    } catch (error) {
      console.error('Error while trying to get title', error)
      return null
    }
  
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
