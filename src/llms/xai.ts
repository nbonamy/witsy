
import { EngineConfig, Configuration } from 'types/config.d'
import OpenAI from './openai'

export const isXAIConfigured = (engineConfig: EngineConfig): boolean => {
  return engineConfig?.apiKey?.length > 0
}

export const isXAIReady = (engineConfig: EngineConfig): boolean => {
  return isXAIConfigured(engineConfig) && engineConfig?.models?.chat?.length > 0
}

export default class extends OpenAI {

  constructor(config: Configuration) {
    super(config, {
      apiKey: config.engines.xai.apiKey,
      baseURL: 'https://api.x.ai/v1',
    })
  }

  getName(): string {
    return 'xai'
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
      { id: 'grok-beta', name: 'Grok Beta' },
    ]

  }

  protected setBaseURL() {
    // avoid override by super
  }

}
