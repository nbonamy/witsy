
import { removeMarkdown } from '@excalidraw/markdown-to-text'
import { ChatModel, LlmChunkTool } from 'multi-llm-ts'
import { CodeExecutionMode, Configuration } from 'types/config'
import { DocRepoQueryResponseItem } from 'types/rag'
import { z } from 'zod'
import Message from '@models/message'
import Generator from './generator'
import { getLlmLocale, i18nInstructions, localeToLangName, t } from './i18n'
import LlmFactory from './llms/llm'

export interface InstructionsModifiers {
  noMarkdown?: boolean
  codeExecutionMode?: CodeExecutionMode
}

export type TaskComplexity = 'simple' | 'normal' | 'complex'

export default class LlmUtils {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  getEngineModelForTask(
    complexity: TaskComplexity,
    preferredEngine?: string,
    fallbackModel?: string
  ): { engine: string; model: string } {

    // Hardcoded model hierarchies by complexity level
    const modelHierarchy: Record<string, Record<string, string>> = {
      simple: {
        'anthropic': 'claude-haiku-4-5',
        'cerebras': 'llama3.1-8b',
        'deepseek': 'deepseek-chat',
        'google': 'gemini-2.5-flash-lite',
        'groq': 'meta-llama/llama-4-scout-17b-16e-instruct',
        'meta': 'Llama-3.3-8B-Instruct',
        'mistralai': 'mistral-small-latest',
        'openai': 'gpt-5-nano',
        'xai': 'grok-3-mini',
      },
      normal: {
        'anthropic': 'claude-sonnet-4-5',
        'cerebras': 'qwen-3-235b-a22b-instruct-2507',
        'deepseek': 'deepseek-chat',
        'google': 'gemini-3-flash-preview',
        'groq': 'llama-3.3-70b-versatile',
        'meta': 'Llama-3.3-70B-Instruct',
        'mistralai': 'mistral-medium-latest',
        'openai': 'gpt-5-mini',
        'xai': 'grok-3',
      },
      complex: {
        'anthropic': 'claude-opus-4-6',
        'cerebras': 'qwen-3-235b-a22b-instruct-2507',
        'deepseek': 'deepseek-reasoner',
        'google': 'gemini-3-pro-preview',
        'groq': 'moonshotai/kimi-k2-instruct-0905',
        'meta': 'Llama-4-Maverick-17B-128E-Instruct-FP8',
        'mistralai': 'mistral-large-latest',
        'openai': 'gpt-5.2',
        'xai': 'grok-4-0709',
      }
    }

    const models = modelHierarchy[complexity]
    const llmManager = LlmFactory.manager(this.config)

    // Try preferred engine first if specified
    if (preferredEngine && llmManager.isEngineReady(preferredEngine)) {

      // do we have models for this
      if (models[preferredEngine]) {
        const model = llmManager.getChatModel(preferredEngine, models[preferredEngine])
        if (model) {
          return { engine: preferredEngine, model: model.id }
        } else {
          const defaultModel = llmManager.getDefaultChatModel(preferredEngine)
          if (defaultModel) {
            return { engine: preferredEngine, model: defaultModel }
          }
        }
      }

      // do we have a fallback model
      if (fallbackModel) {
        return { engine: preferredEngine, model: fallbackModel }
      }
    }

    // Try each engine in order of preference for the complexity level
    for (const [engine, modelId] of Object.entries(models)) {
      if (llmManager.isEngineReady(engine)) {
        const model = llmManager.getChatModel(engine, modelId)
        if (model) {
          return { engine, model: model.id }
        }
      }
    }

    // Fallback to current configured engine/model using LlmManager
    return llmManager.getChatEngineModel(false)
  }

  async getTitle(engine: string, fallbackModel: string, thread: Message[]): Promise<string|null> {

    try {

      // Get optimal model for simple task (titling is simple)
      const { engine: selectedEngine, model: titlingModel } = this.getEngineModelForTask('simple', engine, fallbackModel)

      // build messages
      const messages = [
        new Message('system', i18nInstructions(this.config, 'instructions.utils.titling')),
        thread[1],
        thread[2],
        new Message('user', i18nInstructions(this.config, 'instructions.utils.titlingUser'))
      ]

      // now stream it (anthropic requires streaming)
      const llmManager = LlmFactory.manager(this.config)
      const llm = llmManager.igniteEngine(selectedEngine)
      const model = llmManager.getChatModel(selectedEngine, titlingModel)
      let title = ''
      const stream = llm.generate(model, messages, {
        tools: false,
        toolCallsInThread: false,
        reasoningEffort: 'low',
        thinkingBudget: 0,
        reasoning: false,
      })
      for await (const chunk of stream) {
        if (chunk.type === 'content' && chunk.text) {
          title += chunk.text
        }
      }
      title = title.trim()
      if (title === '') {
        return thread[1].content
      }

      // ollama reasoning removal: everything between <think> and </think>
      title = title.replace(/<think>[\s\S]*?<\/think>/g, '')

      // remove html tags
      title = title.replace(/<[^>]*>/g, '')

      // and markdown
      title = removeMarkdown(title)

      // remove prefixes
      if (title.startsWith('Title:')) {
        title = title.substring(6).trim()
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

  async generateStatusUpdate(engine: string, model: string, prompt: string): Promise<string> {
    const statusInstructions = `You are a status update generator for an autonomous task execution system.

Generate a concise status update (1-2 sentences maximum) for the user based on the current progress.

Examples:
- "Let me analyze your request and create an execution plan."
- "I've created a plan with 5 tasks. Starting execution now."
- "Working on task 2 of 5: writing blog articles."
- "Completed research phase. Moving on to content creation."

Keep it concise, natural, and user-friendly. Do NOT include prefixes like "Status Update:" or technical jargon.`

    return this.run(engine, model, 'simple', statusInstructions, prompt)
  }

  private async run(engine: string, model: string, complexity: TaskComplexity, system: string, prompt: string, opts?: any): Promise<any> {

    // Get optimal model for simple task (titling is simple)
    const { engine: selectedEngine, model: actualModel } = this.getEngineModelForTask(complexity, engine, model)

    const messages = [
      new Message('system', system),
      new Message('user', prompt),
      new Message('assistant', '')
    ]

    // now get it
    const generator = new Generator(this.config)
    const llmManager = LlmFactory.manager(this.config)
    const llm = llmManager.igniteEngine(selectedEngine)
    const actualChatModel: ChatModel = llmManager.getChatModel(selectedEngine, actualModel)
    await generator.generate(llm, messages, {
      model: actualChatModel.id,
      streaming: true,
      tools: false,
      reasoningEffort: 'low',
      thinkingBudget: 0,
      reasoning: false,
      ...opts
    })

    // Return content - if structured output was used, it may be an object
    return messages[2].content.trim()

  }
  
  static parseJson(content: string): any {
    let idx = content.indexOf('{')
    if (idx === -1) throw new Error('No JSON object found in content')
    content = content.slice(idx)
    idx = content.lastIndexOf('}')
    if (idx === -1) throw new Error('No JSON object found in content')
    content = content.slice(0, idx + 1).trim()
    return JSON.parse(content)
  }

  getSystemInstructions(instructions?: string, modifiers?: InstructionsModifiers): string {

    // default
    let instr = instructions
    if (!instr) {
      // Check if it's a custom instruction
      const customInstruction = this.config.llm.customInstructions?.find((ci: any) => ci.id === this.config.llm.instructions)
      if (customInstruction) {
        instr = customInstruction.instructions
      } else {
        instr = i18nInstructions(this.config, `instructions.chat.${this.config.llm.instructions}`)
      }
    }

    // no markdown modifier
    if (modifiers?.noMarkdown) {
      instr += '\n\n' + i18nInstructions(this.config, 'instructions.capabilities.noMarkdown')
    }

    // forced locale
    if (/*instr === i18nInstructions(null, `instructions.chat.${this.config.llm.instructions}`) && */this.config.llm.forceLocale) {
      const lang = localeToLangName(getLlmLocale())
      if (lang.length) {
        instr += '\n\n' + i18nInstructions(this.config, 'instructions.utils.setLang', { lang })
      }
    }

    // code execution
    if (modifiers?.codeExecutionMode && modifiers.codeExecutionMode !== 'disabled') {
      const instructionKey = modifiers.codeExecutionMode === 'program'
        ? 'instructions.capabilities.codeExecutionProgram'
        : 'instructions.capabilities.codeExecutionProxy'
      instr += '\n\n' + i18nInstructions(this.config, instructionKey)
    }

    // retry tools
    if (this.config.llm.additionalInstructions?.toolRetry) {
      instr += '\n\n' + i18nInstructions(this.config, 'instructions.capabilities.toolRetry')
    }

    // capabilities: mermaid
    if (this.config.llm.additionalInstructions?.mermaid) {
      instr += '\n\n' + i18nInstructions(this.config, 'instructions.capabilities.mermaid')
    }

    // capabilities: artifacts
    if (this.config.llm.additionalInstructions?.artifacts) {
      instr += '\n\n' + i18nInstructions(this.config, 'instructions.capabilities.artifacts')
    }

    // add date and time
    if (this.config.llm.additionalInstructions?.datetime) {

      // get it basic
      let date = new Date().toLocaleString()
      try {
        // try advanced (our locale may be wrong)
        date = new Date().toLocaleString(window.api?.config?.localeLLM(), { dateStyle: 'long', timeStyle: 'long' })
      } catch { /* empty */ }

      // add it
      instr += '\n\n' + i18nInstructions(this.config, 'instructions.utils.setDate', { date })
      
    }

    // done
    return instr
  }

  async evaluateOutput(
    engine: string,
    model: string,
    agentGoal: string,
    taskPrompt: string,
    message: Message
  ): Promise<{ quality: 'pass' | 'fail', feedback: string }> {


    const toolCalls = message.toolCalls?.length
      ? message.toolCalls
        .filter(tc => tc.state === 'completed')
        .map(tc => `- ${tc.function}:\n  Parameters: ${JSON.stringify(tc.args)}`).join('\n')//\n  Results: ${JSON.stringify(tc.result)}`).join('\n')
      : 'None'

    const evaluationInstructions = `You are a quality evaluator for autonomous agent outputs.

Evaluate if the output meets the requirements specified in the agent goal and task prompt.

Check for:
1. COMPLETENESS: Does it fulfill all requirements from the agent goal? Does it include the actual data requested?
2. RELEVANCE: Does it properly address the task prompt?
3. FORMAT: Does it follow any format/structure requirements from the agent goal?
4. SUBSTANCE: Is it meaningful content (not just meta-commentary like "I will do X")?
5. LENGTH: Does it meet any length requirements specified in the agent goal?

Return a JSON object with:
{
  "quality": "pass" or "fail",
  "feedback": "Brief explanation of why it passed or failed"
}

Remember that multi-line strings are not allowed in JSON: you must use "line1\\nline2" format for line breaks.

Be strict but fair. If the output is genuinely incomplete, wrong format, or lacks substance, mark it as fail with specific feedback.`

    const evaluationPrompt = `Agent Goal: ${agentGoal}

Task Prompt: ${taskPrompt}

Output to Evaluate:
${message.content.substring(0, 10000)}

Tools Used:
${toolCalls}

Evaluate this output and return your assessment.`

    try {
      const result = await this.run(engine, model, 'normal', evaluationInstructions, evaluationPrompt, {
        structuredOutput: {
          name: 'evaluation_result',
          structure: z.object({
            quality: z.enum(['pass', 'fail']).describe("Quality assessment: pass if meets requirements, fail if incomplete or inadequate"),
            feedback: z.string().describe("Brief explanation of why it passed or failed")
          })
        }
      })

      // Parse structured output (already validated by Zod)
      const parsed = typeof result === 'object' ? result : LlmUtils.parseJson(result)

      return {
        quality: parsed.quality === 'fail' ? 'fail' : 'pass',
        feedback: parsed.feedback || 'No feedback provided'
      }
    } catch (error) {
      console.warn('[llm_utils] Quality evaluation error:', error)
      return { quality: 'pass', feedback: 'Evaluation error, assuming pass' }
    }
  }

  /**
   * Query multiple document repositories and return merged, sorted results with formatted context.
   * Optionally emits tool call status updates for UI feedback.
   */
  static async queryDocRepos(
    config: Configuration,
    docrepoUuids: string[],
    query: string,
    opts?: {
      response?: Message
      noToolsInContent?: boolean
      onToolCallStatus?: (toolCall: LlmChunkTool) => void
    }
  ): Promise<{ sources: DocRepoQueryResponseItem[], context: string }> {

    const allDocRepos = window.api.docrepo.list(config.workspaceId) as any[]
    const sources: DocRepoQueryResponseItem[] = []

    // prepare tool calls if callbacks provided
    const toolCalls: { uuid: string, name: string, toolCall: LlmChunkTool }[] = []
    if (opts?.onToolCallStatus) {
      for (const docrepoUuid of docrepoUuids) {
        const docRepo = allDocRepos.find((repo: any) => repo.uuid === docrepoUuid)
        const docRepoName = docRepo?.name || 'Knowledge Base'
        const runningToolCall: LlmChunkTool = {
          type: 'tool',
          id: crypto.randomUUID(),
          name: 'search_knowledge_base',
          state: 'running',
          status: t('plugins.knowledge.running', { query, docrepo: docRepoName }),
          call: {
            params: { docRepoName, query },
            result: null
          },
          done: false
        }
        toolCalls.push({ uuid: docrepoUuid, name: docRepoName, toolCall: runningToolCall })
        opts.response?.addToolCall(runningToolCall, !opts.noToolsInContent)
        opts.onToolCallStatus(runningToolCall)
      }
    }

    // query all docrepos in parallel
    let results: DocRepoQueryResponseItem[][]
    if (opts?.onToolCallStatus) {
      // with status updates
      results = await Promise.all(
        toolCalls.map(async ({ uuid, name, toolCall }) => {
          const docRepoSources = await window.api.docrepo.query(uuid, query)

          // emit completed status immediately
          const completedToolCall: LlmChunkTool = JSON.parse(JSON.stringify(toolCall))
          completedToolCall.state = 'completed'
          completedToolCall.status = t('plugins.knowledge.completed', { docrepo: name, count: docRepoSources.length })
          completedToolCall.call.result = { count: docRepoSources.length, sources: docRepoSources }
          completedToolCall.done = true
          opts.response?.addToolCall(completedToolCall, !opts.noToolsInContent)
          opts.onToolCallStatus!(completedToolCall)

          return docRepoSources
        })
      )
    } else {
      // simple parallel query without status updates
      results = await Promise.all(
        docrepoUuids.map(uuid => window.api.docrepo.query(uuid, query))
      )
    }

    // assign RRF scores and merge results
    // RRF formula: 1/(k + rank) where k=60 is standard, rank is 1-based
    const RRF_K = 60
    for (const docRepoSources of results) {
      docRepoSources.forEach((source, index) => {
        source.rrfScore = 1 / (RRF_K + index + 1)
      })
      sources.push(...docRepoSources)
    }

    // sort by RRF score (handles cross-source ranking better than raw embedding scores)
    sources.sort((a, b) => (b.rrfScore ?? 0) - (a.rrfScore ?? 0))

    // format context with titles (or no results message)
    let context: string
    if (sources.length === 0) {
      context = i18nInstructions(config, 'instructions.chat.docrepoNoResults')
    } else {
      context = sources.map(source =>
        `[Source: ${source.metadata.title}]\n${source.content}`
      ).join('\n\n---\n\n')
    }

    return { sources, context }
  }

}
