
import { Configuration } from '../types/config.d';
import defaults from '../../defaults/settings.json'
import similarity from 'compute-cosine-similarity'
import OpenAI from 'openai'

export default class {

  config: Configuration
  engine: string
  model: string
  openai: OpenAI

  constructor(config: Configuration, engine: string, model: string) {
    this.config = config
    this.engine = engine
    this.model = model
    this.init()
  }

  init(): void {
    if (this.engine === 'openai') {
      this.openai = new OpenAI({
        apiKey: this.config.engines.openai.apiKey,
        baseURL: this.config.engines.openai.baseURL || defaults.engines.openai.baseURL,
        dangerouslyAllowBrowser: true
      })
    }
  }

  dimensions(): number {

    if (this.engine === 'openai') {
      if (this.model === 'text-embedding-ada-002') return 1536
      if (this.model === 'text-embedding-3-small') return 1536
      if (this.model === 'text-embedding-3-large') return 3072
    }

    // too bad
    return 0

  }

  async embed(text: string): Promise<any> {
    if (this.openai) {
      const embeddings = await this.openai.embeddings.create({ input: text, model: this.model, })
      return embeddings.data[0].embedding
    }
  }

  similarity(a: number[], b: number[]): number {
    return similarity(a, b)
  }

}
