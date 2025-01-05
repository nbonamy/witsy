
import { EngineCreateOpts, ModelsList, OpenAI } from 'multi-llm-ts'

export default class extends OpenAI {

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static isConfigured = (engineConfig: EngineCreateOpts): boolean => {
    return true
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static isReady = (engineConfig: EngineCreateOpts, models: ModelsList): boolean => {
    return OpenAI.isConfigured(engineConfig)
  }
 
}
