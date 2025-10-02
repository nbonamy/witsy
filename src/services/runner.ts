
import { A2APromptOpts, AgentRun, AgentRunTrigger, AgentStep, Chat } from '../types/index'
import { DocRepoQueryResponseItem } from '../types/rag'
import { Configuration } from '../types/config'
import { LlmChunk, LlmChunkContent, MultiToolPlugin } from 'multi-llm-ts'
import { getLlmLocale, i18nInstructions, setLlmLocale, t } from './i18n'
import Generator, { GenerationResult, GenerationOpts, LlmChunkCallback, GenerationCallback } from './generator'
import LlmFactory, { ILlmManager } from '../llms/llm'
import { availablePlugins } from '../plugins/plugins'
import { replacePromptInputs } from '../services/prompt'
import { processJsonSchema } from '../services/schema'
import { store } from '../services/store'
import LlmUtils from './llm_utils'
import Agent from '../models/agent'
import Message from '../models/message'
import AgentPlugin from '../plugins/agent'
import A2AClient from './a2a-client'

export interface RunnerCompletionOpts extends GenerationOpts {
  ephemeral?: boolean
  engine?: string
  agents?: Agent[]
  chat?: Chat
  a2aContext?: A2APromptOpts
  callback?: LlmChunkCallback
}

export const isAgentConversation = (chat: Chat): Agent|null => {

  // check message
  const message = chat.lastMessage()
  if (!message) return null
  if (!message.agentId) return null

  // we need the agent anyway
  const agent = store.agents.find((a) => a.uuid === message.agentId)
  if (!agent) return null

  // a2a agents are conversational
  if (agent && agent.source === 'a2a') {
    return agent
  }

  // nope
  return null

}

export default class extends Generator {

  llmManager: ILlmManager
  workspaceId: string
  agent: Agent

  constructor(config: Configuration, workspaceId: string, agent: Agent) {
    super(config)
    this.llm = null
    this.stream = null
    this.llmManager = LlmFactory.manager(config)
    this.workspaceId = workspaceId
    this.agent = agent
  }

  async run(trigger: AgentRunTrigger, prompt?: string, opts?: RunnerCompletionOpts, generationCallback?: GenerationCallback): Promise<AgentRun> {

    // create a run
    const run: AgentRun = {
      uuid: crypto.randomUUID(),
      agentId: this.agent.uuid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trigger: trigger,
      status: 'running',
      prompt: prompt,
      messages: [],
      toolCalls: [],
    }

    // we need to store each step output
    const outputs: string[] = []

    try {

      // create system message if not exists
      let prevSystemMessage: string
      if (run.messages.length === 0) {
        run.messages.push(new Message('system', ''))
        if (opts?.chat) {
          prevSystemMessage = this.getSystemInstructions()
        }
      } else {
        prevSystemMessage = run.messages[0].content
      }

      // update agent instructions
      run.messages[0].content = this.getSystemInstructions(this.agent.instructions)

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

      // now we can loop on steps
      let rc: GenerationResult = 'error'
      for (let stepIdx = 0; stepIdx < this.agent.steps.length; stepIdx++) {

        // get step
        const step: AgentStep = this.agent.steps[stepIdx]

        // check
        let stepPrompt = stepIdx === 0 ? (prompt?.trim() || step.prompt) : replacePromptInputs(step.prompt,
          outputs.reduce((acc: Record<string, string>, output, idx) => {
            acc[`output.${idx + 1}`] = output
            return acc
          }, {})
        )
        if (!stepPrompt.length) {
          return null
        }

        // docrepo
        if (step.docrepo) {
          const sources: DocRepoQueryResponseItem[] = await window.api.docrepo.query(step.docrepo, stepPrompt);
          if (sources.length) {
            const context = sources.map((source) => source.content).join('\n\n');
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
          docrepo: null,
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

        // make sure llm has latest tools
        this.llm.clearPlugins()
        const multiPluginsAdded: Record<string, MultiToolPlugin> = {}
        for (const pluginName in availablePlugins) {
          
          const pluginClass = availablePlugins[pluginName]
          const plugin = new pluginClass(this.config.plugins[pluginName], this.workspaceId)

          // if no filters add
          if (step.tools === null) {
            this.llm.addPlugin(plugin)
            continue
          }

          // single-tool plugins is easy
          if (!(plugin instanceof MultiToolPlugin)) {
            if (step.tools.includes(plugin.getName())) {
              this.llm.addPlugin(plugin)
            }
            continue
          }

          // multi-tool plugins are more complex
          const pluginTools = await plugin.getTools()
          for (const pluginTool of pluginTools) {
            if (step.tools.includes(pluginTool.function.name)) {

              let instance = multiPluginsAdded[pluginName]
              if (!instance) {
                instance = plugin
                this.llm.addPlugin(instance)
                multiPluginsAdded[pluginName] = instance
              }

              // enable this tool
              instance.enableTool(pluginTool.function.name)
            }

          }

        }

        // and now add tools for running agents
        const agents = [
          ...window.api.agents.load(this.workspaceId),
          ...(opts?.agents || [])
        ]
        for (const agentId of step.agents) {
          const agent = agents.find((a: Agent) => a.uuid === agentId)
          if (agent) {
            const plugin = new AgentPlugin(this.config, this.workspaceId, agent, agent.engine || opts.engine, agent.model || opts.model)
            this.llm.addPlugin(plugin)
          }
        }

        // should we provide status updates
        const provideStatusUpdates = (this.agent.steps.length > 1 || step.description?.trim()?.length)

        // add user message
        const userMessage = new Message('user', stepPrompt)
        userMessage.engine = opts.engine
        userMessage.model = opts.model
        run.messages.push(userMessage)

        // add messages to chat
        if (stepIdx === 0 && opts?.chat) {

          // we add default system instructions to the chat
          // so that the user can continue the conversation in the same style
          if (opts.chat.messages.length === 0) {
            opts.chat.addMessage(new Message('system', this.getSystemInstructions()))
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

        // now depends on the type of agent
        if (this.agent.source === 'a2a') {

          rc = await this.runA2A(run, opts)

        } else {

          // generate text
          rc = await this.prompt(run, opts)

          // check if streaming is not supported
          if (rc === 'streaming_not_supported') {
            opts.streaming = false
            rc = await this.prompt(run, opts)
          }

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

  private async prompt(run: AgentRun, opts: RunnerCompletionOpts): Promise<GenerationResult> {

    return await this.generate(this.llm, [
      run.messages[0],                       // instructions
      run.messages[run.messages.length - 2], // user message
      run.messages[run.messages.length - 1], // assistant message
    ], {
      ...opts,
      ...this.agent.modelOpts,
    }, (chunk: LlmChunk) => {

      //console.log('chunk', chunk)

      if (chunk.type === 'tool' && chunk.done) {
        run.toolCalls.push({
          id: chunk.id,
          name: chunk.name,
          done: chunk.done,
          params: chunk.call.params,
          result: chunk.call.result
        })
      }

      if (opts.callback) {
        opts.callback(chunk)
      }

    })
  }

  private async runA2A(run: AgentRun, opts: RunnerCompletionOpts): Promise<GenerationResult> {

    try {
    
      // init A2A client
      const client = new A2AClient(this.agent.instructions)

      // now process chunks
      const prompt = run.messages.find(m => m.role === 'user')?.content || ''
      for await (const chunk of client.execute(prompt, opts?.a2aContext)) {

        // get the current assistant message (last in the array) to ensure reactivity
        const assistantMessage = run.messages[run.messages.length - 1]

        if (chunk.type === 'content') {
          
          assistantMessage.appendText(chunk)
          opts?.callback?.(chunk)
        
        } else if (chunk.type === 'status') {

          // update chat
          if (chunk.taskId) {
            assistantMessage.a2aContext = {
              currentTaskId: chunk.taskId,
              currentContextId: chunk.contextId,
            }
          } else {
            delete assistantMessage.a2aContext
          }

          // update status
          if (chunk.status) {
            assistantMessage.setStatus(chunk.status)
          }


        } else if (chunk.type === 'artifact') {

          // we build a witsy artifact
          const artifact = `<artifact title="${chunk.name}">
\`\`\`
${chunk.content}
\`\`\`
</artifact>`

          // debug: emit artifact as content
          const textChunk: LlmChunkContent = {
            type: 'content',
            text: `\n\n${artifact}\n\n`,
            done: false,
          }
          assistantMessage.appendText(textChunk)
          opts?.callback?.(textChunk)

        }
      
      }

      // done
      return 'success'

    } catch (error) {
      console.error('Error while running A2A client', error)
      throw error
    }

  }

  private saveRun(run: AgentRun): void {
    window.api.agents.saveRun(this.workspaceId, {
      ...run,
      messages: run.messages.map(m => JSON.parse(JSON.stringify(m))),
    })
  }

  private async getTitle(engine: string, model: string, messages: Message[]): Promise<string> {
    const llmUtils = new LlmUtils(this.config)
    return await llmUtils.getTitle(engine, model, messages)
  }
}
