
import { Configuration } from '../types/config'
import { i18nInstructions } from './i18n'
import { removeMarkdown } from '@excalidraw/markdown-to-text'
import Message from '../models/message'
import LlmFactory from '../llms/llm'

export type TaskComplexity = 'simple' | 'normal' | 'complex'

export default class {

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
