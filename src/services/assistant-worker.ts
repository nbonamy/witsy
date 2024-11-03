
import { LlmChunk } from 'multi-llm-ts'
import { AssistantCompletionOpts } from './assistant'
import { Configuration } from 'types/config.d'
import { DocRepoQueryResponseItem } from 'types/rag.d'
import Chat, { defaultTitle } from '../models/chat'
import Message from '../models/message'
import Attachment from '../models/attachment'
import LlmFactory from '../llms/llm'
import { store } from './store'
import { countryCodeToName } from './i18n'
// @ts-expect-error ?worker import
// eslint-disable-next-line import/no-unresolved
import LlmWorker from './llm-worker?worker'

type ChunkCallback = (chunk: LlmChunk) => void

export default class {

  config: Configuration
  llmFactory: LlmFactory
  engine: string
  llm: LlmWorker
  chat: Chat
  stream: any
  opts: AssistantCompletionOpts
  callback: ChunkCallback
  sources: DocRepoQueryResponseItem[]

  constructor(config: Configuration) {
    this.config = config
    this.engine = null
    this.llm = null
    this.chat = null
    this.stream = null
    this.opts = null
    this.callback = null
    this.llmFactory = new LlmFactory(config)
  }

  setConfig(config: Configuration) {
    this.config = config
    this.llmFactory = new LlmFactory(config)
  }

  setChat(chat: Chat) {
    this.chat = chat
  }

  resetLlm() {
    this.engine = null
    this.llm = null
    this.opts = null
    this.callback = null
  }

  initLlm(engine: string): void {
    
    //
    console.log('Init LLM', engine)

    // same?
    if (this.engine === engine && this.llm !== null) {
      return
    }

    // init the worker
    const worker = new LlmWorker()
    worker.postMessage({ type: 'init', engine: engine, config: JSON.parse(JSON.stringify(this.config)) })
    worker.onmessage = this.onWorkerMessage.bind(this)

    // switch
    this.setLlm(worker ? engine : null, worker)
  }

  setLlm(engine: string, llm: LlmWorker) {
    this.engine = engine
    this.llm = llm
    this.opts = null
    this.callback = null
  }

  hasLlm() {
    return this.llm !== null
  }

  async prompt(prompt: string, opts: AssistantCompletionOpts, callback: ChunkCallback): Promise<void> {

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
      overwriteEngineModel: false,
      systemInstructions: this.config.instructions.default,
    }
    this.opts = {...defaults, ...opts }

    // we need a chat
    if (this.chat === null) {

      // system instructions
      const systemPrompt = opts.systemInstructions || this.config.instructions.default

      // initialize the chat
      this.chat = new Chat()
      this.chat.docrepo = this.opts.docrepo
      this.chat.setEngineModel(this.opts.engine, this.opts.model)
      this.chat.addMessage(new Message('system', this.getLocalizedInstructions(systemPrompt)))
      
      // save
      if (this.opts.save) {
        store.chats.push(this.chat)
        store.saveHistory()
      }
    
    } else if (!this.opts.overwriteEngineModel) {
      // make sure we have the right engine and model
      // special case: chat was started without an apiKey
      // so engine and model are null so we need to keep opts ones...
      this.opts.engine = this.chat.engine || this.opts.engine
      this.opts.model = this.chat.model || this.opts.model
    }

    // we need an llm
    this.initLlm(this.opts.engine)
    if (this.llm === null) {
      return null
    }

    // save the callback
    this.callback = callback

    // add message
    const message = new Message('user', prompt)
    message.attach(this.opts.attachment)
    this.chat.addMessage(message)

    // add assistant message
    this.chat.addMessage(new Message('assistant'))
    callback?.call(null, null)

    // generate text
    await this.generateText()

  }

  async generateText(): Promise<void> {

    try {

      // get messages
      const messages = this.getRelevantChatMessages()

      // rag?
      this.sources = [];
      if (this.chat.docrepo) {
        const userMessage = messages[messages.length - 1];
        this.sources = await window.api.docrepo.query(this.chat.docrepo, userMessage.content);
        //console.log('Sources', JSON.stringify(sources, null, 2));
        if (this.sources.length > 0) {
          const context = this.sources.map((source) => source.content).join('\n\n');
          const prompt = this.config.instructions.docquery.replace('{context}', context).replace('{query}', userMessage.content);
          messages[messages.length - 1] = new Message('user', prompt);
        }
      }

      // now stream
      this.llm.postMessage({ type: 'stream', messages: JSON.parse(JSON.stringify(messages)), opts: JSON.parse(JSON.stringify(this.opts)) })

    } catch (error) {
      console.error('Error while generating text', error)
      this.callback?.call(null, { text: null, done: true })
    }
  
  }

  async onGenerationDone() {

    // append sources
    if (this.sources && this.sources.length > 0) {
      
      // reduce to unique sources based on metadata.id
      const uniqueSourcesMap = new Map();
      this.sources.forEach(source => {
        uniqueSourcesMap.set(source.metadata.uuid, source);
      })
      this.sources = Array.from(uniqueSourcesMap.values());

      // now add them
      let sourcesText = '\n\nSources:\n\n'
      sourcesText += this.sources.map((source) => `- [${source.metadata.title}](${source.metadata.url})`).join('\n')

      // we need this
      const message: Message = this.chat.lastMessage()
      message.appendText({ type: 'content', text: sourcesText, done: true })
      this.callback?.call(null, { type: 'content', text: sourcesText, done: true })
    
    }

    // check if we need to update title
    if (this.opts.titling && this.chat.title === defaultTitle) {
      this.chat.title = await this.getTitle() || this.chat.title
    }
  
    // save
    if (this.opts.save) {
      store.saveHistory()
    }

    // cleanup
    this.stream = null
    this.callback?.call(null, null)
  
  }

  onWorkerMessage(event: MessageEvent<any>) {

    // we need this
    const message: Message = this.chat.lastMessage()
    
    if (event.data.type === 'chunk') {
    
      // message level processing
      message.appendText(event.data)
      if (event.data.chunk?.done) {
        this.onGenerationDone()
      }

      // callback
      this.callback?.call(null, event.data.chunk)

    
    } else if (event.data.type === 'tool') {
    
      message.setToolCall(event.data)
    
    } else if (event.data.type === 'error') {
    
      const error = event.data.error
      if (error.name !== 'AbortError') {
        if (error.status === 401 || error.message.includes('401') || error.message.toLowerCase().includes('apikey')) {
          message.setText('You need to enter your API key in the Models tab of <a href="#settings_models">Settings</a> in order to chat.')
          this.chat.setEngineModel(null, null)
          this.resetLlm()
        } else if (error.status === 400 && (error.message.includes('credit') || error.message.includes('balance'))) {
          message.setText('Sorry, it seems you have run out of credits. Check the balance of your LLM provider account.')
        } else if (error.status === 429 && (error.message.includes('resource') || error.message.includes('quota'))) {
          message.setText('Sorry, it seems you have reached the rate limit of your LLM provider account. Try again later.')
        } else if (message.content === '') {
          message.setText('Sorry, I could not generate text for that prompt.')
        } else {
          message.appendText({ type: 'content', text: '\n\nSorry, I am not able to continue here.', done: true })
        }
      } else {
        this.callback?.call(null, { text: null, done: true })
      }

    }
  }

  async stop() {
    if (this.stream) {
      await this.llm?.stop(this.stream)
      this.chat.lastMessage().appendText({ type: 'content', text: null, done: true })
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
