import { addUsages, LlmChunk, LlmChunkToolAbort, LlmEngine, Plugin } from 'multi-llm-ts'
import { z } from 'zod'
import { ToolCatalog, useTools } from '../composables/tools'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Agent from '../models/agent'
import Chat from '../models/chat'
import Message from '../models/message'
import { Configuration } from '../types/config'
import { StorageSingleton, MemoryPlugin, StoreItem } from './agent_storage'
import * as dr from './deepresearch'
import Generator, { GenerationResult } from './generator'
import { getLlmLocale, setLlmLocale, t } from './i18n'
import LlmUtils from './llm_utils'

const kReadStoredOuputs = false
const kWriteOutputsToStorage = false

type SearchResultItem = {
  title: string
  url: string
  content?: string
}

type StoreItemExtraDeepResearch = {
  agentName?: string
  componentType?: 'plan' | 'search_results' | 'learnings' | 'section' | 'title' | 'exec_summary' | 'conclusion'
  sectionNumber?: number
  searchResults?: SearchResultItem[]
}

export interface DeepResearchALCompletionOpts extends dr.DeepResearchOpts {
  qualityReview?: 'all' | 'deliverable' | 'none'
  maxParallelExecution?: number
  callback?: (chunk: LlmChunk) => void
}

type Decision = {
  status: 'continue' | 'done'
  nextAction?: string
  reasoning: string
  estimatedRemaining?: number

  // For actions (status='continue')
  agentName?: string  // Which deepresearch agent to call
  agentParamsJson?: string  // JSON string with parameters (object or array for parallel), can include _relevantMemory field

  // For completion (status='done')
  deliveryMessage?: string  // Summary message to show user
}

type Reflection = {
  type: 'learning' | 'failure' | 'success'
  message: string
}

type PromptResponse = {
  rc: GenerationResult
  message: Message | null
}

// Helper to safely cast StoreItem extra to DeepResearch type
function getExtra(item: StoreItem): StoreItemExtraDeepResearch | undefined {
  return item?.extra as StoreItemExtraDeepResearch | undefined
}

export function getComponentType(agentName: string, params: any): StoreItemExtraDeepResearch['componentType'] {
  switch (agentName) {
    case 'planning': return 'plan'
    case 'search': return 'search_results'
    case 'analysis': return 'learnings'
    case 'writer': return 'section'
    case 'title': return 'title'
    case 'synthesis':
      return params?.outputType === 'conclusion' ? 'conclusion' : 'exec_summary'
    default: return undefined
  }
}

export default class DeepResearchAgentLoop implements dr.DeepResearch {

  config: Configuration
  llmManager: ILlmManager
  llmUtils: LlmUtils
  workspaceId: string
  agent: Agent
  llm: any

  // Tool management
  private toolCatalog: ToolCatalog | null = null

  // Deepresearch agent mapping
  private deepResearchAgents: Map<string, Agent> = new Map()

  // Track tool abortions for feedback to main loop
  private toolAbortions: LlmChunkToolAbort[] = []

  // Track other reflections (learnings, failures, successes)
  private reflections: Reflection[] = []

  constructor(config: Configuration, workspaceId: string, agent?: Agent) {
    this.config = config
    this.llm = null
    this.llmManager = LlmFactory.manager(config)
    this.llmUtils = new LlmUtils(config)
    this.workspaceId = workspaceId
    this.agent = agent || mainLoopAgent

    // Initialize deepresearch agent mapping
    for (const drAgent of dr.deepResearchAgents) {
      this.deepResearchAgents.set(drAgent.name, drAgent)
    }
  }

  // DeepResearch interface implementation
  async run(engine: LlmEngine, chat: Chat, opts: dr.DeepResearchOpts): Promise<GenerationResult> {
    const researchTopic = chat.messages[1]?.content?.trim() || ''
    return await this.runAgentLoop(researchTopic, chat, {
      ...opts,
      engine: engine.getId(),
      model: opts.model,
    })
  }

  // Internal method for the agent loop
  async runAgentLoop(userRequest: string, chat: Chat, opts?: DeepResearchALCompletionOpts): Promise<GenerationResult> {

    // Generate partition ID for memory
    const partitionId = globalThis.crypto.randomUUID()

    try {

      // clear memory
      StorageSingleton.getInstance().clear(partitionId)
      StorageSingleton.getInstance().setWriteOutputsToStorage(partitionId, kWriteOutputsToStorage)

      // Get the assistant message that was already added by assistant.ts
      const chatMessage = chat.lastMessage()

      // initialize messages for decision loop
      const messages: Message[] = [new Message('system', '')]

      // set llm locale
      let llmLocale = null
      const forceLocale = this.config.llm.forceLocale
      if (this.agent.locale) {
        llmLocale = getLlmLocale()
        setLlmLocale(this.agent.locale)
        this.config.llm.forceLocale = true
      }

      // we need a llm
      opts.engine = this.agent.engine || opts.engine
      opts.model = this.agent.model || this.llmManager.getChatModel(opts.engine, opts.model).id
      this.llm = this.llmManager.igniteEngine(opts.engine)

      // initialize tools (once per run)
      if (!this.toolCatalog) {
        const { getAllAvailableTools } = useTools()
        this.toolCatalog = await getAllAvailableTools(this.config)
        console.log('[deepresearch_al] Tool catalog initialized:', this.toolCatalog.allTools.length, 'tools')
      }

      // log
      console.log('[deepresearch_al] Starting run with request:', userRequest.substring(0, 100))

      // status
      await this.generateStatusUpdate(
        'Let me start analyzing and working on your research request.',
        chatMessage,
        opts
      )
      if (chatMessage) {
        chatMessage.transient = true
      }

      // main loop
      const memory = StorageSingleton.getInstance()

      // Store original full request in memory for reference
      const requestId = memory.store(partitionId, 'User Request (Full Details)', userRequest)
      console.log('[deepresearch_al] Stored original request in memory:', requestId)

      const maxIterations = 30
      let iteration = 0
      let done = false
      let rc: GenerationResult = 'success'
      let researchPlan = '' // Will be set once plan is created
      const iterationHistory: string[] = [] // Track all iterations for context

      try {

        while (!done && iteration < maxIterations) {

          // Check for abort
          if (opts.abortSignal?.aborted) {
            console.log('[deepresearch_al] Aborted by user')
            return 'stopped'
          }

          iteration++
          console.log(`[deepresearch_al] Iteration ${iteration}`)

          // clear tools
          this.llm.clearPlugins()

          // Build context for main agent
          const memoryList = memory.listTitles(partitionId)
          const memoryText = memoryList.length > 0
            ? memoryList.map(it => `- id: ${it.id}, title: "${it.title}"`).join('\n')
            : 'No work completed yet'

          // Build iteration history context
          const historyText = iterationHistory.length > 0
            ? iterationHistory.join('\n')
            : 'No previous iterations yet (this is the first decision)'

          // Build reflection context
          const reflectionContext = this.buildReflectionContext()

          // now add the list of agents
          let agentsList = ''
          for (const agent of this.deepResearchAgents.values()) {
            agentsList += `- ${agent.name}: ${agent.description}\n`
            agentsList += `  parameters: ${JSON.stringify(agent.parameters)}\n`
          }

          // Build prompt for main agent
          messages[0].content = this.llmUtils.getSystemInstructions(mainLoopAgent.instructions, { noMarkdown: true })
            .replace('{{agentsList}}', agentsList)
            .replace('{{numSections}}', String(opts.breadth || 3))
            .replace('{{numQueriesPerSection}}', String(opts.depth || 2))
            .replace('{{maxSearchResults}}', String(opts.searchResults || 8))
          const decisionPrompt = mainLoopAgent.steps[0].prompt
            .replace('{{userRequest}}', userRequest)
            .replace('{{memoryList}}', memoryText)
            .replace('{{researchPlan}}', researchPlan)
            .replace('{{iterationHistory}}', historyText)
            .replace('{{previousReflections}}', reflectionContext)
          messages.push(new Message('user', decisionPrompt))

          if (kWriteOutputsToStorage) {
            window.localStorage.setItem(`prompt_${iteration}`, decisionPrompt)
          }
          
          // Call main agent to decide next action
          const decisionKey = `decision_${iteration}`
          let decisionJson = window.localStorage.getItem(decisionKey)

          if (!kReadStoredOuputs || !decisionJson) {
            const { message: response } = await this.prompt(partitionId, messages[0], messages[messages.length - 1], [], {
              ...opts,
              structuredOutput: mainLoopAgent.steps[0].structuredOutput
            })

            if (response === null) {
              throw new Error(t('generator.errors.cannotContinue'))
            }

            messages.push(response)
            decisionJson = response.content
            
            if (chatMessage) {
              chatMessage.usage = addUsages(chatMessage.usage, response.usage)
            }
            
            if (kWriteOutputsToStorage) {
              window.localStorage.setItem(decisionKey, decisionJson)
            }
          
          } else {
            // Using cached decision, still need to add response to messages
            messages.push(new Message('assistant', decisionJson))
          }

          // Parse decision
          const decision: Decision = typeof decisionJson === 'object' ? decisionJson : LlmUtils.parseJson(decisionJson)
          console.log(`[deepresearch_al] Decision:`, decision.status, decision.nextAction || decision.reasoning)

          // Check termination
          if (decision.status === 'done') {
            console.log('[deepresearch_al] Main agent decided task is complete:', decision.reasoning)

            await this.finalDelivery(partitionId, opts, chatMessage, decision)
            done = true
            break
          }

          // status
          await this.generateStatusUpdate(
            `Working on ${decision.nextAction}. Rationale: ${decision.reasoning}`,
            chatMessage,
            opts
          )

          // Execute the action
          await this.executeAction(partitionId, messages, opts, chatMessage, iteration, decision)

          // Record this iteration in history
          iterationHistory.push(`#${iteration}: ${decision.nextAction || decision.agentName} (agent: ${decision.agentName})`)

          // If planning agent just ran, extract the plan
          if (decision.agentName === 'planning' && !researchPlan) {
            const allItems = Object.values(memory.getAll(partitionId))
            const planItem = allItems.find(i => getExtra(i)?.componentType === 'plan')
            if (planItem) {
              researchPlan = `\n\nRESEARCH PLAN (follow this structure):\n${planItem.body}`
              console.log('[deepresearch_al] Research plan extracted and will be included in subsequent decisions')
            }
          }
        }

        if (iteration >= maxIterations) {
          console.warn('[deepresearch_al] Maximum iterations reached')
          await this.generateStatusUpdate(
            'I have reached the maximum number of iterations.',
            chatMessage,
            opts
          )
        }

        console.log(`[deepresearch_al] Loop completed after ${iteration} iterations`)
        console.log(`[deepresearch_al] Memory contains ${memory.listTitles(partitionId).length} items:`)
        memory.listTitles(partitionId).forEach(it => console.log(`  - ${it.id}: ${it.title}`))

      } catch (e) {
        console.error('[deepresearch_al] Loop error:', e)
        rc = 'error'
        throw e
      }

      // restore llm locale
      if (llmLocale) {
        setLlmLocale(llmLocale)
        this.config.llm.forceLocale = forceLocale
      }

      // return result
      return rc

    } catch {

      // get the current assistant message (last in the array) to ensure reactivity
      const errorMessage = chat.lastMessage()
      if (errorMessage) {
        errorMessage.appendText({ type: 'content', text: t('generator.errors.cannotContinue'), done: true })
      }

      return 'error'

    } finally {

      // clear memory
      StorageSingleton.getInstance().clear(partitionId)

      // Set transient to false so UI shows final state
      const finalMessage = chat.lastMessage()
      if (finalMessage) {
        finalMessage.transient = false
      }

    }

  }

  private async executeAction(
    partitionId: string,
    messages: Message[],
    opts: DeepResearchALCompletionOpts,
    chatMessage: Message | undefined,
    iteration: number,
    decision: Decision,
  ): Promise<void> {
    console.log(`[deepresearch_al] Executing action: ${decision.nextAction}`)

    // Get the agent to execute
    const agent = this.deepResearchAgents.get(decision.agentName)
    if (!agent) {
      console.error(`[deepresearch_al] Unknown agent: ${decision.agentName}`)
      this.reflections.push({
        type: 'failure',
        message: `Unknown agent "${decision.agentName}" requested. Available agents: ${Array.from(this.deepResearchAgents.keys()).join(', ')}`
      })
      return
    }

    // Parse agent params (handle both string and object, and arrays)
    let parsedParams: any = {}
    if (decision.agentParamsJson) {
      if (typeof decision.agentParamsJson === 'string') {
        try {
          parsedParams = JSON.parse(decision.agentParamsJson)
        } catch (e) {
          console.error('[deepresearch_al] Failed to parse agentParamsJson:', e)
        }
      } else {
        // Already an object
        parsedParams = decision.agentParamsJson
      }
    }

    // Normalize to array for parallel execution
    const paramsArray = Array.isArray(parsedParams) ? parsedParams : [parsedParams]

    // Execute with parallel support
    if (paramsArray.length > 1) {
      console.log(`[deepresearch_al] Parallel execution: ${paramsArray.length} tasks`)
    }

    const maxConcurrent = opts.maxParallelExecution || 3
    const running = new Set<Promise<void>>()
    const queue = [...paramsArray]

    let taskIndex = 0
    while (queue.length > 0 || running.size > 0) {
      // Fill available slots
      while (running.size < maxConcurrent && queue.length > 0) {
        const params = queue.shift()!
        const idx = taskIndex++
        const taskDecision = paramsArray.length > 1
          ? { ...decision, nextAction: `${decision.nextAction} #${idx + 1}` }
          : decision

        const promise = this.runAgent(
          partitionId,
          messages,
          opts,
          chatMessage,
          iteration + idx,
          taskDecision,
          agent,
          params
        ).then(() => {
          running.delete(promise)
        })
        running.add(promise)
      }

      // Wait for any task to complete
      if (running.size > 0) {
        await Promise.race(running)
      }
    }

    // Status update (single message for all tasks)
    const taskLabel = paramsArray.length > 1
      ? `${decision.nextAction} (${paramsArray.length} tasks)`
      : decision.nextAction
    await this.generateStatusUpdate(
      `Completed: ${taskLabel}`,
      chatMessage,
      opts
    )
  }

  private async runAgent(
    partitionId: string,
    messages: Message[],
    opts: DeepResearchALCompletionOpts,
    chatMessage: Message | undefined,
    iteration: number,
    decision: Decision,
    agent: Agent,
    params: Record<string, any>
  ): Promise<void> {

    // Get relevant memory content from params._relevantMemory
    const memory = StorageSingleton.getInstance()
    let relevantContext = ''
    const memoryIds = params._relevantMemory as string[] | undefined
    if (memoryIds && memoryIds.length > 0) {
      const items = memoryIds
        .map(id => memory.retrieve(partitionId, id))
        .filter(item => item)
        .map(item => `${item.title}:\n${item.body}`)
      relevantContext = items.join('\n\n---\n\n')
      console.log(`[deepresearch_al] Injecting ${memoryIds.length} relevant memory items into agent context`)
    }

    // Remove _relevantMemory from params before passing to agent
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _relevantMemory, ...cleanParams } = params

    // Build agent instructions with relevant context
    let agentInstructions = agent.instructions
    if (relevantContext) {
      agentInstructions += `\n\n## Relevant Context from Memory:\n${relevantContext}`
    }

    // Determine if output is deliverable based on component type
    const componentType = getComponentType(agent.name, params)
    const isDeliverable = ['section', 'title', 'exec_summary', 'conclusion'].includes(componentType)

    messages[0].content = this.llmUtils.getSystemInstructions(agentInstructions, { noMarkdown: !isDeliverable })

    // Build the prompt from agent step (using cleaned params without _relevantMemory)
    let prompt = agent.steps[0].prompt
    for (const [key, value] of Object.entries(cleanParams)) {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), valueStr)
    }

    messages.push(new Message('user', prompt))

    console.log(`[deepresearch_al] Executing agent: ${agent.name}. Prompt: ${prompt.substring(0, 100)}...`)

    const outputKey = `output_${iteration}_${agent.name}`
    let output = window.localStorage.getItem(outputKey)

    // Track search results if this is a search agent
    const capturedSearchResults: SearchResultItem[] = []

    if (!kReadStoredOuputs || !output) {
      // Resolve and add tools
      const toolPlugins = this.resolveToolPlugins(agent.steps[0].tools || [])
      this.llm.clearPlugins()
      for (const plugin of toolPlugins) {
        this.llm.addPlugin(plugin as any)
      }

      // Wrap callback to capture search results
      const originalCallback = opts.callback
      const wrappedOpts = {
        ...opts,
        callback: (chunk: LlmChunk) => {
          // Capture search_internet tool results for sources
          if (agent.name === 'search' && chunk.type === 'tool' && chunk.name === 'search_internet' && chunk.done && chunk.call?.result?.results) {
            capturedSearchResults.push(...chunk.call.result.results)
          }
          if (originalCallback) {
            originalCallback(chunk)
          }
        }
      }

      const { message: response } = await this.prompt(partitionId, messages[0], messages[messages.length - 1], agent.steps[0].tools || [], wrappedOpts)
      if (response === null) {
        console.warn(`[deepresearch_al] Agent execution failed for: ${decision.nextAction}`)
        return // Continue to next iteration
      }

      output = response?.content
      messages.push(response!)
      
      if (chatMessage) {
        chatMessage.usage = addUsages(chatMessage.usage, response!.usage)
      }
      
      if (kWriteOutputsToStorage) {
        window.localStorage.setItem(outputKey, output)
      }
    
    } else {
      // Using cached output, still need to add response to messages
      messages.push(new Message('assistant', output))
    }

    // log
    console.log(`[deepresearch_al] Action completed. Output length: ${output.length}`)

    // Evaluate output quality if configured
    const qualityMode = opts.qualityReview || 'deliverable'
    const shouldReview =
      qualityMode !== 'none' &&
      (qualityMode === 'all' || (qualityMode === 'deliverable' && isDeliverable))

    if (shouldReview) {
      console.log(`[deepresearch_al] Evaluating output quality (mode: ${qualityMode})`)

      const evaluation = await this.llmUtils.evaluateOutput(
        opts.engine,
        opts.model,
        decision.nextAction,
        prompt,
        output
      )

      console.log(`[deepresearch_al] Quality evaluation result: ${evaluation.quality}`)

      if (evaluation.quality === 'fail') {
        this.reflections.push({
          type: 'failure',
          message: `Action "${decision.nextAction}" failed quality check: ${evaluation.feedback}. Please retry with improvements.`
        })
        console.warn(`[deepresearch_al] Quality check failed: ${evaluation.feedback}`)
        return // Don't store, don't update status - main loop will retry with reflection
      }
    }

    // Store in memory with metadata
    const title = `#${iteration}. ${agent.name}: ${JSON.stringify(cleanParams)}`
    const metadata: StoreItemExtraDeepResearch = {
      agentName: agent.name,
      componentType: componentType,
      sectionNumber: cleanParams.sectionNumber,
      searchResults: capturedSearchResults.length > 0 ? capturedSearchResults : undefined
    }
    const id = memory.store(partitionId, title, output, metadata)
    console.log(`[deepresearch_al] Stored output in memory ${id} (componentType=${componentType}, searchResults=${capturedSearchResults.length})`)
  }

  private async prompt(partitionId: string, instructions: Message, prompt: Message, tools: string[], opts: DeepResearchALCompletionOpts): Promise<PromptResponse> {

    // llm
    const llm = this.llmManager.igniteEngine(opts.engine)

    // plugins
    const toolPlugins = this.resolveToolPlugins(tools || [])
    for (const plugin of toolPlugins) {
      llm.addPlugin(plugin as any)
    }

    // always add storage plugin
    let pluginStorage = this.llm.plugins.find((p: any) => p && typeof p.getName === 'function' && p.getName() === 'short_term_memory')
    if (!pluginStorage) {
      pluginStorage = new MemoryPlugin(partitionId)
      llm.addPlugin(pluginStorage as any)
    }

    // response message
    const response: Message = new Message('assistant', '')

    const generator = new Generator(this.config)
    const rc = await generator.generate(this.llm, [
      instructions,
      prompt,
      response
    ], {
      ...opts,
      ...this.agent.modelOpts,
      noToolsInContent: true,
    }, (chunk: LlmChunk) => {

      if (chunk.type === 'usage') {
        response.usage = addUsages(response.usage, chunk.usage)
      }

      // Pass all chunks to the callback (including tool chunks for search results capture)
      if (opts.callback) {
        opts.callback(chunk)
      }

    })

    return { rc, message: response }
  }

  private async finalDelivery(
    partitionId: string,
    opts: DeepResearchALCompletionOpts,
    chatMessage: Message | undefined,
    decision: Decision
  ): Promise<void> {

    const memory = StorageSingleton.getInstance()

    // Show summary message
    if (decision.deliveryMessage && chatMessage) {
      chatMessage.appendText({ type: 'content', text: `\n\n${decision.deliveryMessage}`, done: false })
    } else {
      await this.generateStatusUpdate(
        'I have completed all tasks for your research request.',
        chatMessage,
        opts
      )
    }

    // Extract research components from memory using componentType
    const allItems = Object.values(memory.getAll(partitionId))

    // Extract title
    const titleItem = allItems.find(i => getExtra(i)?.componentType === 'title')
    let reportTitle = 'Research Report'
    if (titleItem) {
      try {
        const titleData = LlmUtils.parseJson(titleItem.body)
        reportTitle = titleData?.title || titleItem.body.trim()
      } catch {
        reportTitle = titleItem.body.trim()
      }
    }

    // Extract executive summary
    const execSummary = allItems.find(i => getExtra(i)?.componentType === 'exec_summary')?.body || ''

    // Extract conclusion
    const conclusion = allItems.find(i => getExtra(i)?.componentType === 'conclusion')?.body || ''

    // Extract sections (sorted by sectionNumber)
    const sections = allItems
      .filter(i => getExtra(i)?.componentType === 'section')
      .sort((a, b) => (getExtra(a)?.sectionNumber || 0) - (getExtra(b)?.sectionNumber || 0))
      .map(i => i.body)

    // Extract search results for sources
    const searchResults = allItems
      .filter(i => getExtra(i)?.componentType === 'search_results' && getExtra(i)?.searchResults)
      .flatMap(i => getExtra(i)?.searchResults || [])

    // Assemble the report
    let reportContent = `\n\n<artifact title="${reportTitle}">`

    // Executive summary
    if (execSummary) {
      reportContent += `\n\n${execSummary}`
    }

    // Sections
    for (const section of sections) {
      reportContent += `\n\n---\n\n${section}`
    }

    // Conclusion
    if (conclusion) {
      reportContent += `\n\n---\n\n${conclusion}`
    }

    // Sources (deduplicated)
    if (searchResults && searchResults.length > 0) {
      const uniqueSources = new Map<string, SearchResultItem>()
      for (const result of searchResults) {
        if (result?.url) {
          const cleanUrl = result.url.split('#:~:text=')[0]
          if (!uniqueSources.has(cleanUrl)) {
            uniqueSources.set(cleanUrl, result)
          }
        }
      }

      if (uniqueSources.size > 0) {
        reportContent += `\n\n---\n\n### Sources:\n`
        for (const result of uniqueSources.values()) {
          const escapedUrl = result.url.replaceAll('(', '%28').replaceAll(')', '%29')
          reportContent += `- [${result.title}](${escapedUrl})\n`
        }
      }
    }

    reportContent += '\n</artifact>'

    // add to chat
    if (chatMessage) {
      chatMessage.appendText({
        type: 'content',
        text: reportContent,
        done: true
      })
    }

  }

  // Resolve tool IDs to Plugin instances
  private resolveToolPlugins(toolIds: string[]): Plugin[] {

    if (!this.toolCatalog) {
      return []
    }

    const plugins: Plugin[] = []
    for (const toolId of toolIds) {
      const tool = this.toolCatalog.allTools.find(t => t.id === toolId)
      if (tool) {
        plugins.push(tool.plugin)
        // Note: setMaxResults configuration would go here if needed
        // Currently deepresearch agents specify maxResults in their parameters
      } else if (toolId !== 'short_term_memory') {
        console.warn(`[deepresearch_al] Tool not found: ${toolId}`)
      }
    }

    return plugins
  }

  private async generateStatusUpdate(prompt: string, response: Message, opts: DeepResearchALCompletionOpts): Promise<void> {
    if (!response) return

    const status = await this.llmUtils.generateStatusUpdate(opts.engine, opts.model, prompt)

    response.transient = true
    response.status = status
  }

  private buildReflectionContext(): string {
    if (this.toolAbortions.length === 0 && this.reflections.length === 0) {
      return ''
    }

    let context = ''

    // Tool abortions with special instructions
    if (this.toolAbortions.length > 0) {
      context += `
IMPORTANT - Tool Abortions:
The user has blocked the following tool executions:
${this.toolAbortions.map(abort => `- Tool: ${abort.name}
  Params: ${JSON.stringify(abort.params)}
  Reason: ${abort.reason.decision || 'User denied'}`).join('\n\n')}

You have these options:
1. Skip actions that require these tools (if not critical)
2. Try alternative approach without those tools
3. If request cannot be fulfilled without these tools, return status="done" with deliveryMessage explaining the limitation

DO NOT retry the exact same tool - user already denied it.
`
    }

    // Other reflections (learnings, failures, successes)
    if (this.reflections.length > 0) {
      context += `${this.toolAbortions.length > 0 ? '\n' : ''}
PREVIOUS LEARNINGS & FEEDBACK:
${this.reflections.map((r, i) => `${i + 1}. ${r.message}`).join('\n')}
`
    }

    return context
  }

}

// ==================== MAIN LOOP AGENT ====================

export const mainLoopAgent = Agent.fromJson({
  name: 'deep_research_main_loop',
  description: 'Strategic research coordinator that orchestrates deepresearch agents',
  instructions: `You are a strategic research coordinator using the ReAct pattern (Reasoning + Acting).

CRITICAL: You DO NOT execute research yourself. You only DECIDE which deepresearch agent to invoke next.

Your ONLY job is to review the current state and make decisions in JSON format.

Your responsibilities:
1. Understand the user's research goal
2. Review what research has been accomplished (check memory)
3. Decide which deepresearch agent to call next
4. Identify which memory items are relevant for this action
5. Recognize when the research is complete

Available deepresearch agents:
{{agentsList}}

Research configuration:
- Target number of sections: {{numSections}}
- Search queries per section: {{numQueriesPerSection}}
- Search results per query: {{maxSearchResults}}

Use these values when calling the planning agent (numSections, numQueriesPerSection) and search agent (maxResults).

Typical research workflow (inferred from memory state):
1. If no plan exists → call "planning" agent
2. If plan exists but no search results → call "search" agent for queries
3. If search results exist but no key learnings → call "analysis" agent
4. If key learnings exist but no section content → call "writer" agent
5. If all sections done but no exec summary → call "synthesis" agent for executive_summary
6. If exec summary exists but no conclusion → call "synthesis" agent for conclusion
7. If all content ready but no title → call "title" agent
8. If everything complete → status="done"

Decision rules:
- If research is COMPLETE: return status "done" with deliveryMessage
- If more work needed: return status "continue" with nextAction, agentName, and agentParamsJson
- For PARALLEL EXECUTION: Use array in agentParamsJson
  - Each param object can include "_relevantMemory" field with memory IDs for that task
  - Example: [{"searchQuery":"q1","maxResults":8,"_relevantMemory":["plan-id"]}, {"searchQuery":"q2","maxResults":8,"_relevantMemory":["plan-id"]}]
  - Tasks execute concurrently (3x+ faster)
- For SINGLE TASK: Include "_relevantMemory" in the param object
  - Example: {"searchQuery":"q1","maxResults":8,"_relevantMemory":["plan-id","search-id"]}
- Be strategic: infer research state from memory contents
- Don't repeat work that's already in memory
- Estimate remaining actions if possible (helps with progress tracking)

CRITICAL - Using _relevantMemory (Be Selective):
- The original user request is stored in memory as "User Request (Full Details)"
- ONLY include memory IDs when the agent TRULY needs that specific content
- Don't include memory items "just in case"
- Each task's params should have its own "_relevantMemory" array

Examples:
{
  "status": "continue",
  "nextAction": "Create research plan",
  "agentName": "planning",
  "agentParamsJson": {"userQuery":"<from request>","numSections":3,"numQueriesPerSection":2,"_relevantMemory":["request-id"]},
  "reasoning": "No plan exists yet, starting with planning phase.",
  "estimatedRemaining": 10
}

{
  "status": "continue",
  "nextAction": "Search for Section 1",
  "agentName": "search",
  "agentParamsJson": [{"searchQuery":"quantum basics","maxResults":8,"_relevantMemory":["plan-id"]},{"searchQuery":"quantum applications","maxResults":8,"_relevantMemory":["plan-id"]}],
  "reasoning": "Plan complete, executing 2 searches in parallel for first section.",
  "estimatedRemaining": 8
}

{
  "status": "continue",
  "nextAction": "Write Section 1",
  "agentName": "writer",
  "agentParamsJson": {"sectionNumber":1,"sectionTitle":"Introduction","sectionObjective":"Overview","keyLearnings":["learning1"],"_relevantMemory":["analysis-id1"]},
  "reasoning": "Analysis complete, generating section content.",
  "estimatedRemaining": 5
}

{
  "status": "continue",
  "nextAction": "Generate executive summary",
  "agentName": "synthesis",
  "agentParamsJson": {"researchTopic":"<topic>","keyLearnings":["learning1","learning2"],"outputType":"executive_summary","_relevantMemory":["learnings-id1","learnings-id2"]},
  "reasoning": "All sections complete, creating executive summary.",
  "estimatedRemaining": 2
}

{
  "status": "done",
  "deliveryMessage": "Research complete! I've compiled a comprehensive report with 3 sections.",
  "reasoning": "All research components complete: plan, searches, analysis, sections, exec summary, conclusion, and title."
}
`,
  parameters: [
    {
      name: 'userRequest',
      type: 'string',
      description: 'The user research request to fulfill',
      required: true
    },
    {
      name: 'memoryList',
      type: 'string',
      description: 'List of items currently in memory',
      required: true
    },
    {
      name: 'previousReflections',
      type: 'string',
      description: 'Previous reflections or evaluations',
      required: false
    }
  ],
  steps: [{
    prompt: `User research request: {{userRequest}}

{{researchPlan}}

Previous iterations:
{{iterationHistory}}

Memory (completed work):
{{memoryList}}

{{previousReflections}}

Decide which deepresearch agent to invoke next to fulfill this research request.`,
    tools: [],
    agents: []
  }]
},
  () => t('deepResearch.mainLoop.starting'),
  () => t('deepResearch.mainLoop.running'),
  () => t('deepResearch.mainLoop.completed'),
  () => t('deepResearch.mainLoop.error'),
)

// Add structured output schema
mainLoopAgent.steps[0].structuredOutput = {
  name: 'research_decision',
  structure: z.object({
    status: z.enum(['continue', 'done']).describe("Status: continue with work or done (complete)"),
    nextAction: z.string().nullable().optional().describe("Human-readable description of next action"),
    agentName: z.string().nullable().optional().describe("Which deepresearch agent to call: planning, search, analysis, writer, title, or synthesis"),
    agentParamsJson: z.string().nullable().optional().describe("JSON string containing parameters to pass to the agent. Can include '_relevantMemory' field. Example: {\"userQuery\":\"...\",\"_relevantMemory\":[\"id1\"]}"),
    reasoning: z.string().describe("Explanation of decision and current progress"),
    estimatedRemaining: z.number().nullable().optional().describe("Estimated number of remaining actions (helps with progress tracking)"),
    deliveryMessage: z.string().nullable().optional().describe("Summary message when status='done'")
  })
}
