import { GenerateContentConfig } from '@google/genai'
import { ChatModel, Google, LlmCompletionOpts } from 'multi-llm-ts'

export default class GoogleEngine extends Google {

  protected async getGenerationConfig(model: ChatModel, opts?: LlmCompletionOpts): Promise<GenerateContentConfig|undefined> {

    // we need opts
    if (!opts) opts = {} 

    // default thinking budget to automatic
    if (typeof opts.thinkingBudget === 'undefined') {
      opts.thinkingBudget = -1
    }

    // use default
    return await super.getGenerationConfig(model, opts)

  }
  
}
