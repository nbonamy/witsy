
import { Expert, MessageExecutionType } from 'types'
import { Configuration } from 'types/config'
import { LlmEngine } from 'multi-llm-ts'
import { fullExpertI18n, getLlmLocale, setLlmLocale } from './i18n'
import Generator, { GenerationResult, GenerationOpts, LlmChunkCallback, GenerationCallback } from './generator'
import { availablePlugins } from '../plugins/plugins'
import Chat from '../models/chat'
import Message from '../models/message'
import Attachment from '../models/attachment'
import LlmFactory, { ILlmManager } from '../llms/llm'
import LlmUtils from './llm_utils'
import DeepResearchMultiAgent from './deepresearch_ma'
import DeepResearchMultiStep from './deepresearch_ms'
import { DeepResearch } from './deepresearch'

export interface AssistantCompletionOpts extends GenerationOpts {
  engine?: string
  execType?: MessageExecutionType
  titling?: boolean
  instructions?: string|null
  attachments?: Attachment[]
  expert?: Expert
  noMarkdown?: boolean
}

export default class {

  config: Configuration
  workspaceId: string
  llmManager: ILlmManager
  deepResearch: DeepResearch
  llm: LlmEngine|null
  chat: Chat

  constructor(config: Configuration, workspaceId?: string) {
    this.config = config
    this.llm = null
    this.deepResearch = null
    this.workspaceId = workspaceId || config.workspaceId
    this.llmManager = LlmFactory.manager(config)
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

    // we need a prompt or at least attachments
    prompt = prompt.trim()
    if (prompt === '' && (!opts.attachments || opts.attachments.length === 0)) {
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
    const llmUtils = new LlmUtils(this.config)
    this.chat.messages[0].content = llmUtils.getSystemInstructions(this.chat.instructions, { noMarkdown: opts.noMarkdown })

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
      await this.llmManager.loadTools(this.llm, this.workspaceId, availablePlugins, this.chat.tools)
    } else {
      this.llm.clearPlugins()
    }

    // save this
    const hadPlugins = this.llm.plugins.length > 0

    // add user message
    const userMessage = new Message('user', prompt)
    userMessage.setExpert(fullExpertI18n(opts.expert))
    userMessage.engine = opts.engine
    userMessage.model = opts.model
    userMessage.execType = opts?.execType || 'prompt'
    opts.attachments.map(a => userMessage.attach(a))
    this.chat.addMessage(userMessage)

    // add assistant message
    const assistantMessage = new Message('assistant')
    assistantMessage.engine = opts.engine
    assistantMessage.model = opts.model
    assistantMessage.execType = opts?.execType || 'prompt'
    this.chat.addMessage(assistantMessage)
    llmCallback?.call(null, null)

    // callback
    generationCallback?.('before_generation')

    // deep research will come with its own instructions
    let rc: GenerationResult = 'error'
    if (userMessage.execType === 'deepresearch') {
      // const dpOpts = useDeepResearchMultiAgent(this.config, this.llm, this.chat, opts)
      // this.chat.messages[0].content = this.getSystemInstructions(this.chat.messages[0].content)
      // opts = { ...opts, ...dpOpts }

      const useMultiAgent = this.config.deepresearch.runtime === 'ma'
      this.deepResearch = useMultiAgent ? new DeepResearchMultiAgent(this.config, this.workspaceId) : new DeepResearchMultiStep(this.config, this.workspaceId)
      rc = await this.deepResearch.run(this.llm, this.chat, {
        ...opts,
        breadth: this.config.deepresearch.breadth,
        depth: this.config.deepresearch.depth,
        searchResults: this.config.deepresearch.searchResults,
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
      generationCallback?.('plugins_disabled')
      this.chat.disableTools()
    }

    // check if we need to update title
    if (opts.titling && !this.chat.hasTitle()) {
      generationCallback?.('before_title')
      this.chat.title = await this.getTitle() || this.chat.title
    }

    // restore llm locale
    if (llmLocale) {
      setLlmLocale(llmLocale)
      this.config.llm.forceLocale = forceLocale
    }

    // done
    generationCallback?.('generation_done')
    return rc
  
  }

  async _prompt(opts: AssistantCompletionOpts, llmCallback: LlmChunkCallback): Promise<GenerationResult> {
    const generator = new Generator(this.config)
    return await generator.generate(this.llm, this.chat.messages, {
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

  private async getTitle(): Promise<string> {
    const llmUtils = new LlmUtils(this.config)
    return await llmUtils.getTitle(this.chat.engine, this.chat.model, this.chat.messages)
  }

}
