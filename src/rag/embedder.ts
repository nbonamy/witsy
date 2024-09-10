
import { Configuration } from '../types/config.d'
import { App } from 'electron'
import defaults from '../../defaults/settings.json'
import similarity from 'compute-cosine-similarity'
//import { FlagEmbedding, EmbeddingModel } from 'fastembed'
import { Ollama } from 'ollama/dist/browser.mjs'
import OpenAI from 'openai'
import { Embedding } from 'openai/resources'
// import path from 'path'
// import fs from 'fs'

// const fastEmbedRoot = (app: App): string => {
//   return path.join(app.getPath('userData'), 'fastembed')
// }

// const fastEmbedModelFile = (app: App, model: string): string => {
//   const modelRoot = fastEmbedRoot(app)
//   const modelDir = path.join(modelRoot, `fast-${model}`)
//   const modelFile = path.join(modelDir, 'config.json')
//   return modelFile
// }

export default class Embedder {

  config: Configuration
  engine: string
  model: string
  openai: OpenAI
  ollama: Ollama
  //fastembed: FlagEmbedding

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

    } else if (this.engine === 'ollama') {

      this.ollama = new Ollama({
        host: this.config.engines.ollama.baseURL,
      })

    // } else if (this.engine === 'fastembed') {

    //   // fastembed models
    //   const fastEmbedModels:{[key: string]: EmbeddingModel} = {
    //     'all-MiniLM-L6-v2': EmbeddingModel.AllMiniLML6V2,
    //     'bge-base-en': EmbeddingModel.BGEBaseEN,
    //     'bge-base-en-v1.5': EmbeddingModel.BGEBaseENV15,
    //     'bge-small-en': EmbeddingModel.BGESmallEN,
    //     'bge-small-en-v1.5': EmbeddingModel.BGESmallENV15,
    //     'bge-small-zh-v1.5': EmbeddingModel.BGESmallZH,
    //     'multilingual-e5-large': EmbeddingModel.MLE5Large,
    //   }

    //   // select model and create
    //   let fastEmbedModel = fastEmbedModels[this.model]
    //   if (fastEmbedModel) {
    //     this.fastembed = await FlagEmbedding.init({
    //       model: fastEmbedModel,
    //       cacheDir: fastEmbedRoot(app),
    //     })
    //   } else {
    //     throw new Error(`Unsupported FastEmbed model: ${this.model}`)
    //   }
    
    } else {
      throw new Error(`Unsupported embedding engine: ${this.engine}`)
    }
  }

  static async dimensions(config: Configuration, engine: string, model: string): Promise<number> {

    // open ai
    if (engine === 'openai') {
      if (model === 'text-embedding-ada-002') return 1536
      if (model === 'text-embedding-3-small') return 1536
      if (model === 'text-embedding-3-large') return 3072
    }

    // ollama
    if (engine === 'ollama') {
      const ollama = new Ollama({ host: config.engines.ollama.baseURL, })
      const info = await ollama.show({ model: model })
      for (const item in info.model_info) {
        if (item.includes('embedding_length')) {
          return info.model_info[item] as number
        }
      }
    }

    // // fast embed
    // if (engine === 'fastembed') {
    //   if (model === 'all-MiniLM-L6-v2') return 384
    //   if (model === 'bge-base-en') return 768
    //   if (model === 'bge-base-en-v1.5') return 768
    //   if (model === 'bge-small-en') return 384
    //   if (model === 'bge-small-en-v1.5') return 384
    //   if (model === 'bge-small-zh-v1.5') return 512
    //   if (model === 'multilingual-e5-large') return 1024
    // }

    // too bad
    return 0

  }

  async embed(texts: string[]): Promise<number[][]> {

    // for testing purposes
    //return Array(Embedder.dimensions(this.engine, this.model)).fill(0)

    // openai
    if (this.openai) {
      const response = await this.openai.embeddings.create({ input: texts, model: this.model, })
      return response.data.map((item: Embedding) => item.embedding)
    }

    // ollama
    if (this.ollama) {
      const response = await this.ollama.embed({ model: this.model, input: texts, })
      return response.embeddings
    }

    // // fast embed
    // if (this.fastembed) {
    //   const response = this.fastembed.embed([text])
    //   for await (const batch of response) {
    //     return Object.values(batch[0])
    // }

    // too bad
    return null

  }

  similarity(a: number[], b: number[]): number {
    return similarity(a, b)
  }

  static isModelReady(app: App, engine: string, model: string): boolean {
    // if (engine === 'fastembed') {
    //   const modelFile = fastEmbedModelFile(app, model)
    //   return fs.existsSync(modelFile)
    // }
    return true
  }

}
