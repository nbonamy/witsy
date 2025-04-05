
import { EngineConfig } from '../types/config';
import { LlmCompletionOpts, LlmEngine, LlmResponse, LlmStreamingResponse, Message, Model } from 'multi-llm-ts'

export default class Witsy extends LlmEngine {

  constructor(config: EngineConfig) {
    super(config)
  }

  getName(): string {
    return 'witsy'
  }

  async getModels(): Promise<Model[]> {

    // need an api key
    if (!this.config.apiKey) {
      return []
    }

    // call
    const response = await fetch('https://api.witsyai.com/llm/models', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      }
    })

    // do it
    const json = await response.json()

    // filter and transform
    return json.models
      .map((model: any) => ({
        id: `${model.engine}-${model.model}`,
        name: model.label,
        meta: model
      }))
  }

  async complete(model: string, thread: Message[], opts?: LlmCompletionOpts): Promise<LlmResponse> {
    return null

  }

  async stream(model: string, thread: Message[], opts?: LlmCompletionOpts): Promise<LlmStreamingResponse> {
    return null
  }

}

