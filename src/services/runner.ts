
import { Configuration } from 'types/config'
import { AgentRun, AgentRunTrigger } from '../types/index'
import { LlmChunk, MultiToolPlugin } from 'multi-llm-ts'
import { getLlmLocale, setLlmLocale } from './i18n'
import Generator, { GenerationResult, GenerationOpts, LlmChunkCallback } from './generator'
import LlmFactory, { ILlmManager } from '../llms/llm'
import { availablePlugins } from '../plugins/plugins'
import Agent from '../models/agent'
import Message from '../models/message'
import AgentPlugin from '../plugins/agent'

export type GenerationEvent = 'before_generation' | 'plugins_disabled' | 'before_title'

export type GenerationCallback = (event: GenerationEvent) => void

export interface RunnerCompletionOpts extends GenerationOpts {
  ephemeral: boolean
  engine?: string
  agents?: Agent[]
  callback?: LlmChunkCallback
}

export default class extends Generator {

  llmManager: ILlmManager
  agent: Agent

  constructor(config: Configuration, agent: Agent) {
    super(config)
    this.llm = null
    this.stream = null
    this.llmManager = LlmFactory.manager(config)
    this.agent = agent
  }

  async run(trigger: AgentRunTrigger, prompt?: string, opts?: RunnerCompletionOpts): Promise<AgentRun> {

    // check
    prompt = prompt?.trim() || this.agent.prompt
    if (!prompt.length) {
      return null
    }

    // create a run
    const run: AgentRun = {
      id: crypto.randomUUID(),
      agentId: this.agent.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trigger: trigger,
      status: 'running',
      prompt: prompt,
      messages: [],
      toolCalls: [],
    }

    try {

      // save it
      if (!opts?.ephemeral) {
        window.api.agents.saveRun(run)
      }
      
      // set llm locale
      let llmLocale = null
      const forceLocale = this.config.llm.forceLocale
      if (this.agent.locale) {
        llmLocale = getLlmLocale()
        setLlmLocale(this.agent.locale)
        this.config.llm.forceLocale = true
      }

      // merge with defaults
      const defaults: GenerationOpts = {
        ... this.llmManager.getChatEngineModel(),
        structuredOutput: this.agent.structuredOutput,
        docrepo: null,
        sources: true,
        citations: true,
      }
      opts = {...defaults, ...opts }

      // we need a chat
      const system: Message = new Message('system', this.getSystemInstructions(this.agent.instructions))
      run.messages.push(system)

      // disable streaming
      //opts.streaming = opts.streaming ?? (this.agent.disableStreaming !== true)

      // we need a llm
      opts.engine = this.agent.engine || opts.engine
      opts.model = this.agent.model || this.llmManager.getChatModel(opts.engine, opts.model).id
      this.llm = this.llmManager.igniteEngine(opts.engine)

      // make sure llm has latest tools
      this.llm.clearPlugins()
      const multiPluginsAdded: Record<string, MultiToolPlugin> = {}
      for (const pluginName in availablePlugins) {
        
        const pluginClass = availablePlugins[pluginName]
        const plugin = new pluginClass(this.config.plugins[pluginName])

        // if no filters add
        if (this.agent.tools === null) {
          this.llm.addPlugin(plugin)
          continue
        }

        // single-tool plugins is easy
        if (!(plugin instanceof MultiToolPlugin)) {
          if (this.agent.tools.includes(plugin.getName())) {
            this.llm.addPlugin(plugin)
          }
          continue
        }

        // multi-tool plugins are more complex
        const pluginTools = await plugin.getTools()
        for (const pluginTool of pluginTools) {
          if (this.agent.tools.includes(pluginTool.function.name)) {

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
        ...window.api.agents.load(),
        ...(opts?.agents || [])
      ]
      for (const agentId of this.agent.agents) {
        const agent = agents.find(a => a.id === agentId)
        if (agent) {
          const plugin = new AgentPlugin(this.config, agent, agent.engine || opts.engine, agent.model || opts.model)
          this.llm.addPlugin(plugin)
        }
      }

      // add user message
      const userMessage = new Message('user', prompt)
      userMessage.engine = opts.engine
      userMessage.model = opts.model
      run.messages.push(userMessage)

      // add assistant message
      const assistantMessage = new Message('assistant')
      assistantMessage.engine = opts.engine
      assistantMessage.model = opts.model
      run.messages.push(assistantMessage)

      // save again
      if (!opts?.ephemeral) {
        window.api.agents.saveRun(run)
      }

      // generate text
      let rc: GenerationResult = await this._prompt(run, opts)

      // check if streaming is not supported
      if (rc === 'streaming_not_supported') {
        this.agent.disableStreaming = true
        rc = await this._prompt(run, opts)
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
        window.api.agents.saveRun(run)
      }

    } catch (error) {

      run.status = 'error'
      run.error = error.message
      run.updatedAt = Date.now()
      if (!opts?.ephemeral) {
        window.api.agents.saveRun(run)
      }

    }

    // done
    return run

  }

  async _prompt(run: AgentRun, opts: RunnerCompletionOpts): Promise<GenerationResult> {
    return await this.generate(this.llm, run.messages, {
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

}
