
import { Expert } from 'types'
import { Configuration } from 'types/config'
import { LlmEngine } from 'multi-llm-ts'
import { expertI18n, getLlmLocale, i18nInstructions, setLlmLocale } from './i18n'
import Generator, { GenerationResult, GenerationOpts, LlmChunkCallback } from './generator'
import { removeMarkdown } from '@excalidraw/markdown-to-text'
import { availablePlugins } from '../plugins/plugins'
import Chat from '../models/chat'
import Message from '../models/message'
import Attachment from '../models/attachment'
import LlmFactory, { ILlmManager } from '../llms/llm'
import DeepResearchMultiAgent from './deepresearch_ma'
import DeepResearchMultiStep from './deepresearch_ms'
import { DeepResearch } from './deepresearch'

export type GenerationEvent = 'before_generation' | 'plugins_disabled' | 'before_title'

export type GenerationCallback = (event: GenerationEvent) => void

export interface AssistantCompletionOpts extends GenerationOpts {
  engine?: string
  deepResearch?: boolean
  titling?: boolean
  instructions?: string|null
  attachments?: Attachment[]
  expert?: Expert
}

export default class extends Generator {

  llmManager: ILlmManager
  deepResearch: DeepResearch
  chat: Chat

  constructor(config: Configuration) {
    super(config)
    this.llm = null
    this.stream = null
    this.deepResearch = null
    this.llmManager = LlmFactory.manager(config)
    this.chat = new Chat()
  }

  async stop() {
    this.deepResearch?.stop()
    super.stop()
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
    
    // // same?
    // if (this.llm !== null && this.llm.getName() === engine) {
    //   return
    // }

    // switch
    const llm = this.llmManager.igniteEngine(engine)
    this.setLlm(llm)
  }

  setLlm(llm: LlmEngine) {
    this.llm = llm
  }

  hasLlm() {
    return this.llm !== null
  }

  async prompt(prompt: string, opts: AssistantCompletionOpts, llmCallback: LlmChunkCallback, generationCallback?: GenerationCallback): Promise<GenerationResult> {

    // check
    prompt = prompt.trim()
    if (prompt === '') {
      return null
    }

    // set llm locale
    let llmLocale = null
    const forceLocale = this.config.llm.forceLocale
    if (this.chat.locale) {
      llmLocale = getLlmLocale()
      setLlmLocale(this.chat.locale)
      this.config.llm.forceLocale = true
    }

    // merge with defaults
    const defaults: AssistantCompletionOpts = {
      ... this.llmManager.getChatEngineModel(),
      instructions: null,
      titling: true,
      attachments: [],
      docrepo: null,
      expert: null,
      sources: true,
      citations: true,
      caching: true,
    }
    opts = {...defaults, ...opts }

    // we need a chat
    if (this.chat === null) {
      this.initChat()
    }

    // create system message if not exists
    if (this.chat.messages.length === 0) {
      this.chat.addMessage(new Message('system', ''))
    }

    // update system message with latest instructions
    this.chat.messages[0].content = this.getSystemInstructions(this.chat.instructions)

    // make sure we have the right engine and model
    // special case: chat was started without an apiKey
    // so engine and model are null so we need to keep opts ones...
    opts.engine = this.chat.engine || opts.engine
    opts.model = this.chat.model || opts.model
    opts.docrepo = this.chat.docrepo || opts.docrepo

    // disable streaming
    opts.streaming = opts.streaming ?? (this.chat.disableStreaming !== true)

    // make sure chat options are set
    this.chat.setEngineModel(opts.engine, opts.model)
    this.chat.docrepo = opts.docrepo

    // we need an llm
    this.initLlm(opts.engine)
    if (this.llm === null) {
      return null
    }

    // make sure llm has latest tools
    if (!this.llmManager.isComputerUseModel(opts.engine, opts.model)) {
      await this.llmManager.loadTools(this.llm, availablePlugins, this.chat.tools)
    } else {
      this.llm.clearPlugins()
    }

    // save this
    const hadPlugins = this.llm.plugins.length > 0

    // deep research?
    const deepReseach = opts?.deepResearch

    // add user message
    const userMessage = new Message('user', prompt)
    userMessage.setExpert(opts.expert, expertI18n(opts.expert, 'prompt'))
    userMessage.engine = opts.engine
    userMessage.model = opts.model
    userMessage.deepResearch = deepReseach
    opts.attachments.map(a => userMessage.attach(a))
    this.chat.addMessage(userMessage)

    // add assistant message
    const assistantMessage = new Message('assistant')
    assistantMessage.engine = opts.engine
    assistantMessage.model = opts.model
    assistantMessage.deepResearch = deepReseach
    this.chat.addMessage(assistantMessage)
    llmCallback?.call(null, null)

    // callback
    generationCallback?.call(null, 'before_generation')

    // deep research will come with its own instructions
    let rc: GenerationResult = 'error'
    if (deepReseach) {
      // const dpOpts = useDeepResearchMultiAgent(this.config, this.llm, this.chat, opts)
      // this.chat.messages[0].content = this.getSystemInstructions(this.chat.messages[0].content)
      // opts = { ...opts, ...dpOpts }

      const useMultiAgent = this.config.deepresearch.runtime === 'ma'
      this.deepResearch = useMultiAgent ? new DeepResearchMultiAgent(this.config) : new DeepResearchMultiStep(this.config)
      rc = await this.deepResearch.run(this.llm, this.chat, {
        ...opts,
        breadth: this.config.deepresearch.breadth,
        depth: this.config.deepresearch.depth,
      })
      
    } else {

      // generate text
      rc = await this._prompt(opts, llmCallback)

      // check if streaming is not supported
      if (rc === 'streaming_not_supported') {
        this.chat.disableStreaming = true
        rc = await this._prompt(opts, llmCallback)
      }

    }

    // titling
    if (rc !== 'success') {
      opts.titling = false
    }

    // check if generator disabled plugins
    if (hadPlugins && this.llm.plugins.length === 0) {
      generationCallback?.call(null, 'plugins_disabled')
      this.chat.disableTools()
    }

    // check if we need to update title
    if (opts.titling && !this.chat.hasTitle()) {
      generationCallback?.call(null, 'before_title')
      this.chat.title = await this.getTitle() || this.chat.title
    }

    // restore llm locale
    if (llmLocale) {
      setLlmLocale(llmLocale)
      this.config.llm.forceLocale = forceLocale
    }

    // done
    return rc
  
  }

  async _prompt(opts: AssistantCompletionOpts, llmCallback: LlmChunkCallback): Promise<GenerationResult> {
    return await this.generate(this.llm, this.chat.messages, {
      ...opts,
      ...this.chat.modelOpts,
    }, llmCallback)
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
        new Message('system', i18nInstructions(this.config, 'instructions.utils.titling')),
        this.chat.messages[1],
        this.chat.messages[2],
        new Message('user', i18nInstructions(this.config, 'instructions.utils.titlingUser'))
      ]

      // now get it
      this.initLlm(this.chat.engine)
      const model = this.llmManager.getChatModel(this.chat.engine, this.chat.model)
      const response = await this.llm.complete(model, messages, { tools: false })
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
