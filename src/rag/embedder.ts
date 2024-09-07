
import { Configuration } from '../types/config.d'
import { App } from 'electron'
import defaults from '../../defaults/settings.json'
import similarity from 'compute-cosine-similarity'
import { FlagEmbedding, EmbeddingModel } from 'fastembed'
import OpenAI from 'openai'
import path from 'path'
import fs from 'fs'

const fastEmbedRoot = (app: App): string => {
  return path.join(app.getPath('userData'), 'fastembed')
}

const fastEmbedModelFile = (app: App, model: string): string => {
  const modelRoot = fastEmbedRoot(app)
  const modelDir = path.join(modelRoot, `fast-${model}`)
  const modelFile = path.join(modelDir, 'config.json')
  return modelFile
}

export default class Embedder {

  config: Configuration
  engine: string
  model: string
  openai: OpenAI
  fastembed: FlagEmbedding

  static async init(app: App, config: Configuration, engine: string, model: string): Promise<Embedder> {
    const embedder = new Embedder(config, engine, model)
    await embedder.init(app)
    return embedder
  }

  constructor(config: Configuration, engine: string, model: string) {
    this.config = config
    this.engine = engine
    this.model = model
  }

  async init(app: App): Promise<void> {
    
    if (this.engine === 'openai') {

      this.openai = new OpenAI({
        apiKey: this.config.engines.openai.apiKey,
        baseURL: this.config.engines.openai.baseURL || defaults.engines.openai.baseURL,
        dangerouslyAllowBrowser: true
      })
    
    } else if (this.engine === 'fastembed') {

      // fastembed models
      const fastEmbedModels:{[key: string]: EmbeddingModel} = {
        'all-MiniLM-L6-v2': EmbeddingModel.AllMiniLML6V2,
        'bge-base-en': EmbeddingModel.BGEBaseEN,
        'bge-base-en-v1.5': EmbeddingModel.BGEBaseENV15,
        'bge-small-en': EmbeddingModel.BGESmallEN,
        'bge-small-en-v1.5': EmbeddingModel.BGESmallENV15,
        'bge-small-zh-v1.5': EmbeddingModel.BGESmallZH,
        'multilingual-e5-large': EmbeddingModel.MLE5Large,
      }

      // select model and create
      let fastEmbedModel = fastEmbedModels[this.model]
      if (fastEmbedModel) {
        this.fastembed = await FlagEmbedding.init({
          model: fastEmbedModel,
          cacheDir: fastEmbedRoot(app),
        })
      } else {
        throw new Error(`Unsupported FastEmbed model: ${this.model}`)
      }
    
    } else {
      throw new Error(`Unsupported embedding engine: ${this.engine}`)
    }
  }

  static dimensions(engine: string, model: string): number {

    // open ai
    if (engine === 'openai') {
      if (model === 'text-embedding-ada-002') return 1536
      if (model === 'text-embedding-3-small') return 1536
      if (model === 'text-embedding-3-large') return 3072
    }

    // fast embed
    if (engine === 'fastembed') {
      if (model === 'all-MiniLM-L6-v2') return 384
      if (model === 'bge-base-en') return 768
      if (model === 'bge-base-en-v1.5') return 768
      if (model === 'bge-small-en') return 384
      if (model === 'bge-small-en-v1.5') return 384
      if (model === 'bge-small-zh-v1.5') return 512
      if (model === 'multilingual-e5-large') return 1024
    }

    // too bad
    return 0

  }

  async embed(text: string): Promise<any> {

    // based on engine
    if (this.openai) {
      const embeddings = await this.openai.embeddings.create({ input: text, model: this.model, })
      return embeddings.data[0].embedding
    } else if (this.fastembed) {
      const embeddings = this.fastembed.embed([text])
      for await (const batch of embeddings) {
        return Object.values(batch[0])
      }
    }

    // too bad
    return null

  }

  similarity(a: number[], b: number[]): number {
    return similarity(a, b)
  }

  static isModelReady(app: App, engine: string, model: string): boolean {
    if (engine === 'openai') return true
    if (engine === 'fastembed') {
      const modelFile = fastEmbedModelFile(app, model)
      return fs.existsSync(modelFile)
    }
    return false
  }

}
