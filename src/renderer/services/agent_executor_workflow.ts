
import { LlmChunk, LlmEngine } from 'multi-llm-ts'
import { AgentRun, AgentRunTrigger, AgentStep } from 'types/agents'
import { Configuration } from 'types/config'
import { Chat, Expert } from 'types/index'
import { v7 as uuidv7 } from 'uuid'
import Agent from '@models/agent'
import Message from '@models/message'
import AgentExecutorBase from './agent_executor_base'
import Generator, { GenerationCallback, GenerationOpts, GenerationResult, LlmChunkCallback } from './generator'
import { fullExpertI18n, getLlmLocale, i18nInstructions, setLlmLocale, t } from './i18n'
import LlmUtils from './llm_utils'
import { replacePromptInputs } from './prompt'
import { processJsonSchema } from './schema'

export interface AgentWorkflowExecutorOpts extends GenerationOpts {
  runId?: string
  ephemeral?: boolean
  engine?: string
  agents?: Agent[]
  chat?: Chat
  callback?: LlmChunkCallback
}

export default class AgentWorkflowExecutor extends AgentExecutorBase {

  llmUtils: LlmUtils
  llm: LlmEngine|null

  constructor(config: Configuration, workspaceId: string, agent: Agent) {
    super(config, workspaceId, agent)
    this.llm = null
    this.llmUtils = new LlmUtils(config)
  }

  async run(trigger: AgentRunTrigger, values: Record<string, string>, opts?: AgentWorkflowExecutorOpts, generationCallback?: GenerationCallback): Promise<AgentRun> {

    // create a run
    const run: AgentRun = {
      uuid: opts?.runId || uuidv7(),
      agentId: this.agent.uuid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trigger: trigger,
      status: 'running',
      prompt: null, // Will be computed from first step
      messages: [],
    }

    // if not ephemeral, save it now
    if (!opts?.ephemeral) {
      this.agent.lastRunId = run.uuid
      this.saveAgent()
      this.saveRun(run)
    }

    // we need to store each step output
    const outputs: string[] = []

    try {

      // create system message if not exists
      let prevSystemMessage: string
      if (run.messages.length === 0) {
        run.messages.push(new Message('system', ''))
        if (opts?.chat) {
          prevSystemMessage = this.llmUtils.getSystemInstructions()
        }
      } else {
        prevSystemMessage = run.messages[0].content
      }

      // update agent instructions
      run.messages[0].content = this.llmUtils.getSystemInstructions(this.agent.instructions, { codeExecutionMode: this.codeExecutionMode })

      // save it
      if (!opts?.ephemeral) {
        this.saveRun(run)
      }
      
      // set llm locale
      let llmLocale = null
      const forceLocale = this.config.llm.forceLocale
      if (this.agent.locale) {
        llmLocale = getLlmLocale()
        setLlmLocale(this.agent.locale)
        this.config.llm.forceLocale = true
      }

      // load experts if any step uses them (JIT optimization)
      let experts: Expert[] = []
      if (this.agent.steps.some((s) => s.expert)) {
        experts = window.api.experts.load(this.workspaceId)
      }

      // now we can loop on steps
      let rc: GenerationResult = 'error'
      for (let stepIdx = 0; stepIdx < this.agent.steps.length; stepIdx++) {

        // check abort signal before each step
        if (this.checkAbort(run, opts)) {
          return run
        }

        // get step
        const step: AgentStep = this.agent.steps[stepIdx]

        // merge user values with system values (output.N from previous steps)
        const allValues = {
          ...values,
          ...outputs.reduce((acc: Record<string, string>, output, idx) => {
            acc[`output.${idx + 1}`] = output
            return acc
          }, {})
        }

        // replace variables in step prompt
        let stepPrompt = replacePromptInputs(step.prompt || '', allValues)
        if (!stepPrompt.trim().length) {
          throw new Error(`Step ${stepIdx + 1} has an empty prompt after variable substitution`)
        }

        // store the first step prompt in the run for historical purposes
        if (stepIdx === 0) {
          run.prompt = stepPrompt
        }

        // @ts-expect-error backwards compatibility: migrate docrepo to docrepos
        const stepDocRepos = step.docrepos?.length ? step.docrepos : (step.docrepo ? [step.docrepo] : [])
        if (stepDocRepos.length) {

          // check abort before expensive query
          if (this.checkAbort(run, opts)) {
            return run
          }

          // query all docrepos and merge results
          const { context } = await LlmUtils.queryDocRepos(this.config, stepDocRepos, stepPrompt)
          if (context) {
            const instructions = i18nInstructions(this.config, 'instructions.agent.docquery')
            stepPrompt += `\n\n${instructions.replace('{context}', context)}`
          }
        }

        // structured output
        const stepStructuredOutput = step.structuredOutput ?? processJsonSchema('response', step.jsonSchema) ?? undefined
        if (step.jsonSchema) {
          const instructions = i18nInstructions(this.config, 'instructions.agent.structuredOutput')
          stepPrompt += `\n\n${instructions.replace('{jsonSchema}', step.jsonSchema)}`
        }

        // merge with defaults
        const defaults: GenerationOpts = {
          ... this.llmManager.getChatEngineModel(),
          structuredOutput: stepStructuredOutput,
          docrepos: null,
          sources: true,
          citations: true,
        }
        opts = {...defaults, ...opts }

        // disable streaming
        opts.streaming = opts.streaming ?? (this.agent.disableStreaming !== true)

        // we need a llm
        opts.engine = this.agent.engine || opts.engine
        opts.model = this.agent.model || this.llmManager.getChatModel(opts.engine, opts.model).id
        this.llm = this.llmManager.igniteEngine(opts.engine)

        // update chat if relevant
        if (opts?.chat && stepIdx === 0) {
            opts.chat.setEngineModel(opts.engine, opts.model)
            opts.chat.locale = this.agent.locale || opts.chat.locale
           opts.chat.modelOpts = this.agent.modelOpts || null
        }

        // check abort before tool loading
        if (this.checkAbort(run, opts)) {
          return run
        }

        // load tools for this step
        await this.loadToolsAndAgents(this.llm, step.tools, step.agents, opts)

        // should we provide status updates
        const provideStatusUpdates = (this.agent.steps.length > 1 || step.description?.trim()?.length)

        // add user message
        const userMessage = new Message('user', stepPrompt)
        userMessage.engine = opts.engine
        userMessage.model = opts.model

        // attach expert if configured for this step
        if (step.expert) {
          const expert = experts.find(e => e.id === step.expert)
          if (expert) {
            userMessage.setExpert(fullExpertI18n(expert))
          }
        }

        run.messages.push(userMessage)

        // add messages to chat
        if (stepIdx === 0 && opts?.chat) {

          // we add default system instructions to the chat
          // so that the user can continue the conversation in the same style
          if (opts.chat.messages.length === 0) {
            opts.chat.addMessage(new Message('system', this.llmUtils.getSystemInstructions()))
          }

          // user
          opts.chat.addMessage(userMessage)

          // we need the assistant one for the ui to update properly
          const responseMessage = new Message('assistant')
          responseMessage.agentId = this.agent.uuid
          responseMessage.agentRunId = run.uuid
          responseMessage.status = provideStatusUpdates ? t('chat.agent.status.starting') : null
          opts.chat.addMessage(responseMessage)
        
        }

        // we need this
        const responseMessage = opts.chat?.lastMessage()

        // add assistant message
        const assistantMessage = (stepIdx === this.agent.steps.length - 1 && opts.chat) ? responseMessage : new Message('assistant')
        assistantMessage.engine = opts.engine
        assistantMessage.model = opts.model
        run.messages.push(assistantMessage)

        // callback
        generationCallback?.('before_generation')

        // save again
        if (!opts?.ephemeral) {
          this.saveRun(run)
        }

        // update status
        if (responseMessage && provideStatusUpdates) {
          responseMessage.status =
            step.description?.trim() ||
            t('chat.agent.status.inProgress', { step: stepIdx + 1, steps: this.agent.steps.length })
        }

        // generate text
        rc = await this.prompt(run, opts)

        // check if streaming is not supported
        if (rc === 'streaming_not_supported') {
          opts.streaming = false
          rc = await this.prompt(run, opts)
        }

        // if error break now
        if (rc !== 'success') {
          break
        }

        // save output
        outputs.push(assistantMessage.contentForModel)

      }

      // titling
      if (rc === 'success' && opts?.chat && !opts.chat.hasTitle()) {

        // check abort before titling
        if (this.checkAbort(run, opts)) {
          return run
        }

        generationCallback?.('before_title')
        const title = await this.getTitle(opts.engine, opts.model, opts.chat.messages)
        opts.chat.title = title
      }

      // restore llm locale
      if (llmLocale) {
        setLlmLocale(llmLocale)
        this.config.llm.forceLocale = forceLocale
      }

      // save
      run.status = 'success'
      run.updatedAt = Date.now()
      if (!opts?.ephemeral) {
        this.saveRun(run)
      }

      // restore system instructions
      if (prevSystemMessage) {
        run.messages[0].content = prevSystemMessage
      }

    } catch (error) {

      // get the current assistant message (last in the array) to ensure reactivity
      const assistantMessage = run.messages[run.messages.length - 1]
      assistantMessage.appendText({ type: 'content', text: t('generator.errors.cannotContinue'), done: true })

      // record the error
      run.status = 'error'
      run.error = error.message
      run.updatedAt = Date.now()
      if (!opts?.ephemeral) {
        this.saveRun(run)
      }

    }

    // done
    generationCallback?.('generation_done')
    return run

  }

  private async prompt(run: AgentRun, opts: AgentWorkflowExecutorOpts): Promise<GenerationResult> {

    const generator = new Generator(this.config)
    return await generator.generate(this.llm, [
      run.messages[0],                       // instructions
      run.messages[run.messages.length - 2], // user message
      run.messages[run.messages.length - 1], // assistant message
    ], {
      ...opts,
      ...this.agent.modelOpts,
    }, (chunk: LlmChunk) => {

      //console.log('chunk', chunk)

      if (opts.callback) {
        opts.callback(chunk)
      }

    })
  }

  private async getTitle(engine: string, model: string, messages: Message[]): Promise<string> {
    const llmUtils = new LlmUtils(this.config)
    return await llmUtils.getTitle(engine, model, messages)
  }
}
