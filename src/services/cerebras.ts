import { EngineConfig, Configuration } from '../types/config.d'
import OpenAI from './openai'

export const isCerebeasReady = (engineConfig: EngineConfig): boolean => {
  return engineConfig?.apiKey?.length > 0 && engineConfig?.models?.chat?.length > 0
}

export default class extends OpenAI {

  constructor(config: Configuration) {
    super(config, {
      apiKey: config.engines.cerebras.apiKey,
      baseURL: 'https://api.cerebras.ai/v1',
    })
  }

  getName(): string {
    return 'cerebras'
  }

  getVisionModels(): string[] {
    return []
  }
  
  async getModels(): Promise<any[]> {
    // need an api key
    if (!this.client.apiKey) {
      return null
    }

    // do it
    return [
      { id: 'llama3.1-8b', name: 'Llama 3.1 8b' },
      { id: 'llama3.1-70b', name: 'Llama 3.1 70b' },
    ]

  }

  protected setBaseURL() {
    // avoid override by super
  }

  getAvailableTools(): any[] {
    return []
  }

}
