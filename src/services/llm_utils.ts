
import { removeMarkdown } from '@excalidraw/markdown-to-text'
import { ChatModel } from 'multi-llm-ts'
import { z } from 'zod'
import LlmFactory from '../llms/llm'
import Message from '../models/message'
import { Configuration } from '../types/config'
import Generator from './generator'
import { getLlmLocale, i18nInstructions, localeToLangName } from './i18n'

export interface InstructionsModifiers {
  noMarkdown?: boolean
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
        'openai': 'gpt-4.1-mini',
        'anthropic': 'claude-3-5-haiku-20241022',
        'google': 'gemini-2.5-flash',
        'xai': 'grok-3-mini',
        'mistralai': 'mistral-small-latest',
        'cerebras': 'llama-3.3-70b',
        'deepseek': 'deepseek-chat',
        'groq': 'meta-llama/llama-4-scout-17b-16e-instruct',
      },
      normal: {
        'openai': 'gpt-4.1-mini',
        'anthropic': 'claude-sonnet-4-20250514',
        'google': 'gemini-2.5-flash',
        'xai': 'grok-3',
        'mistralai': 'mistral-medium-latest',
        'groq': 'llama-3.3-70b-versatile',
        'cerebras': 'llama-3.3-70b',
        'deepseek': 'deepseek-chat',
      },
      complex: {
        'openai': 'gpt-4.1',
        'anthropic': 'claude-opus-4-1-20250805',
        'google': 'gemini-2.5-pro',
        'xai': 'grok-4-0709',
        'mistralai': 'mistral-large-latest',
        'groq': 'llama-3.3-70b-versatile',
        'cerebras': 'llama-3.3-70b',
        'deepseek': 'deepseek-chat',
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

      // now get it
      const llmManager = LlmFactory.manager(this.config)
      const llm = llmManager.igniteEngine(selectedEngine)
      const model = llmManager.getChatModel(selectedEngine, titlingModel)
      const response = await llm.complete(model, messages, {
        tools: false,
        reasoningEffort: 'low',
        thinkingBudget: 0,
        reasoning: false,
      })
      let title = response.content.trim()
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
      streaming: complexity === 'simple' ? false : true,
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
        .map(tc => `- ${tc.name}:\n  Parameters: ${JSON.stringify(tc.params)}`).join('\n')//\n  Results: ${JSON.stringify(tc.result)}`).join('\n')
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

}
