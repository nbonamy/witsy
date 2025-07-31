
import { Configuration } from 'types/config'
import { AgentRun, AgentRunTrigger } from '../types/index'
import { LlmChunk, LlmChunkContent, MultiToolPlugin } from 'multi-llm-ts'
import { getLlmLocale, setLlmLocale } from './i18n'
import Generator, { GenerationResult, GenerationOpts, LlmChunkCallback } from './generator'
import LlmFactory, { ILlmManager } from '../llms/llm'
import { availablePlugins } from '../plugins/plugins'
import Agent from '../models/agent'
import Message from '../models/message'
import Attachment from '../models/attachment'
import AgentPlugin from '../plugins/agent'
import A2AClient from './a2a-client'

export type GenerationEvent = 'before_generation' | 'plugins_disabled' | 'before_title'

export type GenerationCallback = (event: GenerationEvent) => void

export interface RunnerCompletionOpts extends GenerationOpts {
  ephemeral?: boolean
  engine?: string
  agents?: Agent[]
  messages?: Message[]
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
      messages: opts?.messages || [],
      toolCalls: [],
    }

    try {

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
      opts.streaming = opts.streaming ?? (this.agent.disableStreaming !== true)

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
        this.saveRun(run)
      }

      // now depends on the type of agent
      if (this.agent.source === 'a2a') {

        await this.runA2A(run, opts)

      } else {

        // generate text
        let rc: GenerationResult = await this.prompt(run, opts)

        // check if streaming is not supported
        if (rc === 'streaming_not_supported') {
          this.agent.disableStreaming = true
          rc = await this.prompt(run, opts)
        }

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

    } catch (error) {

      run.status = 'error'
      run.error = error.message
      run.updatedAt = Date.now()
      if (!opts?.ephemeral) {
        this.saveRun(run)
      }

    }

    // done
    return run

  }

  private async prompt(run: AgentRun, opts: RunnerCompletionOpts): Promise<GenerationResult> {

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

  private async runA2A(run: AgentRun, opts: RunnerCompletionOpts): Promise<void> {

    // init A2A client
    const client = new A2AClient(this.agent.instructions)

    // now process chunks
    const prompt = run.messages.find(m => m.role === 'user')?.content || ''
    for await (const chunk of client.execute(prompt)) {

      // get the current assistant message (last in the array) to ensure reactivity
      const assistantMessage = run.messages[run.messages.length - 1]

      if (chunk.type === 'content') {
        
        assistantMessage.appendText(chunk)
        opts?.callback?.(chunk)
      
      } else if (chunk.type === 'status') {

        // for now emit text status
        const textChunk: LlmChunkContent = {
          type: 'content',
          text: `${chunk.status}\n\n`,
          done: false,
        }
        assistantMessage.appendText(textChunk)
        opts?.callback?.(textChunk)

      } else if (chunk.type === 'artifact') {

        // debug: emit test
        const textChunk: LlmChunkContent = {
          type: 'content',
          text: `artifact \`${chunk.name}\`:\n\n\`\`\`${chunk.content}\`\`\`\n\n`,
          done: false,
        }
        assistantMessage.appendText(textChunk)
        opts?.callback?.(textChunk)

        // attach
        assistantMessage.attach(new Attachment(chunk.content, 'text/plain', chunk.name))

      }


    }

  }

  private saveRun(run: AgentRun): void {
    window.api.agents.saveRun({
      ...run,
      messages: run.messages.map(m => JSON.parse(JSON.stringify(m))),
    })
  }

}
