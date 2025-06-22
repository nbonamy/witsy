
import { Configuration } from '../types/config'
import LlmFactory from '../llms/llm'
import Falai from './falai'
import HuggingFace from './huggingface'
import Replicate from './replicate'
import SDWebUI from './sdwebui'

export interface ModelLoader {
  loadModels(): Promise<boolean>
}

export class LlmModelLoader implements ModelLoader {

  config: Configuration
  engine: string

  constructor(config: Configuration, engine: string) {
    this.config = config
    this.engine = engine
  }

  async loadModels(): Promise<boolean> {
    const llmManager = LlmFactory.manager(this.config)
    return llmManager.loadModels(this.engine)
  }
}

export default class ModelLoaderFactory {

  static create(config: Configuration, engine: string): ModelLoader {
    if (engine === 'sdwebui') {
      return new SDWebUI(config)
    } else if (engine === 'huggingface') {
      return new HuggingFace(config)
    } else if (engine === 'replicate') {
      return new Replicate(config)
    } else if (engine === 'falai') {
      return new Falai(config)
    } else {
      return new LlmModelLoader(config, engine)
    }
  }

}
