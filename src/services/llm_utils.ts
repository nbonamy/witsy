
import { Configuration } from '../types/config'
import { i18nInstructions } from './i18n'
import { removeMarkdown } from '@excalidraw/markdown-to-text'
import Message from '../models/message'
import LlmFactory from '../llms/llm'

export default class {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  async getTitle(engine: string, fallbackModel: string, thread: Message[]): Promise<string|null> {

    try {

      // hard-coded (??)
      const titlingModels: Record<string, string> = {
        'anthropic': 'claude-3-5-haiku-20241022',
        'cerebras': 'llama-3.3-70b',
        'deepseek': 'deepseek-chat',
        'google': 'gemini-2.5-flash-lite-preview-06-17',
        'groq': 'meta-llama/llama-4-scout-17b-16e-instruct',
        'mistralai': 'mistral-medium-latest',
        'openai': 'gpt-4.1-mini',
        'xai': 'grok-3-mini',
      }

      // we need to select a titling model
      let titlingModel = titlingModels[engine]
      if (titlingModel) {
        titlingModel = this.config.engines[engine]?.models?.chat.find(m => m.id === titlingModel)?.id
      }
      if (!titlingModel) {
        titlingModel = fallbackModel
      }

      // build messages
      const messages = [
        new Message('system', i18nInstructions(this.config, 'instructions.utils.titling')),
        thread[1],
        thread[2],
        new Message('user', i18nInstructions(this.config, 'instructions.utils.titlingUser'))
      ]

      // now get it
      const llmManager = LlmFactory.manager(this.config)
      const llm = llmManager.igniteEngine(engine)
      const model = llmManager.getChatModel(engine, titlingModel)
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
