
import { EngineConfig, OpenAI } from "multi-llm-ts";

export default class extends OpenAI {

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static isConfigured = (engineConfig: EngineConfig): boolean => {
    return true
  }

  static isReady = (engineConfig: EngineConfig): boolean => {
    return OpenAI.isConfigured(engineConfig)
  }
 
}
