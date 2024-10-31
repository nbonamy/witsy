
import { LlmEngine, LlmCompletionOpts, LlmChunk } from 'multi-llm-ts'
import { Configuration } from 'types/config.d'
import { DocRepoQueryResponseItem } from 'types/rag.d'
import Chat, { defaultTitle } from '../models/chat'
import Attachment from '../models/attachment'
import Message from '../models/message'
import LlmFactory from '../llms/llm'
import { store } from './store'
import { countryCodeToName } from './i18n'
import { availablePlugins } from '../plugins/plugins'

export default class {

  config: Configuration
  llmFactory: LlmFactory
  engine: string
  llm: LlmEngine
  chat: Chat
  stopGeneration: boolean
  stream: AsyncGenerator<LlmChunk, void, void>

  constructor(config: Configuration) {
    this.config = config
    this.engine = null
    this.llm = null
    this.chat = null
    this.stream = null
    this.llmFactory = new LlmFactory(config)
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
    const llm = this.llmFactory.igniteEngine(engine)
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
      ... this.llmFactory.getChatEngineModel(),
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
    for (const pluginName in availablePlugins) {
      const pluginClass = availablePlugins[pluginName]
      const instance = new pluginClass(this.config.plugins[pluginName])
      this.llm.addPlugin(instance)
    }

    // add message
    const message = new Message('user', prompt)
    message.attach(opts.attachment)
    this.chat.addMessage(message)

    // add assistant message
    this.chat.addMessage(new Message('assistant'))
    callback?.call(null, null)

    // generate text
    await this.generateText(opts, callback)

    // check if we need to update title
    if (opts.titling && this.chat.title === defaultTitle) {
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
      this.stopGeneration = false
      this.stream = await llm.generate(messages, opts)
      for await (const msg of this.stream) {
        if (this.stopGeneration) {
          break
        }
        if (msg.type === 'tool') {
            message.setToolCall(msg.text)
        } else if (msg.type === 'content') {
          if (msg && sources && sources.length > 0) {
            msg.done = false
          }
          message.appendText(msg)
          callback?.call(null, msg)
        }
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
        message.appendText({ type: 'content', text: sourcesText, done: true })
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
        } else if (error.status === 429 && (error.message.includes('resource') || error.message.includes('quota'))) {
          message.setText('Sorry, it seems you have reached the rate limit of your LLM provider account. Try again later.')
          opts.titling = false
        } else if (message.content === '') {
          message.setText('Sorry, I could not generate text for that prompt.')
          opts.titling = false
        } else {
          message.appendText({ type: 'content', text: '\n\nSorry, I am not able to continue here.', done: true })
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
      this.stopGeneration = true
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
    for (const message of messages) {
      if (message.attachment && !message.attachment.contents) {
        message.attachment.loadContents()
      }
    }
    return messages
  }

  getLocalizedInstructions(instructions: string) {
    const instr = instructions
    if (!this.config.general.language) return instr
    return instr + ' Always answer in ' + countryCodeToName(this.config.general.language) + '.'
  }

}
