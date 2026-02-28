
import similarity from 'compute-cosine-similarity'
import { App } from 'electron'
import { Configuration, CustomEngineConfig } from 'types/config'
import defaults from '@root/defaults/settings.json'
//import { FlagEmbedding, EmbeddingModel } from 'fastembed'
import { GoogleGenAI } from '@google/genai'
import { Ollama } from 'ollama'
import OpenAI from 'openai'
import { Embedding } from 'openai/resources'
import LlmFactory, { ILlmManager } from '@renderer/services/llms/llm'
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
  google: GoogleGenAI
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async init(app: App): Promise<void> {
    
    // we need this
    const llmManager: ILlmManager = LlmFactory.manager(this.config)
    
    if (this.engine === 'openai') {

      this.openai = new OpenAI({
        apiKey: this.config.engines.openai.apiKey,
        baseURL: this.config.engines.openai.baseURL || defaults.engines.openai.baseURL,
        dangerouslyAllowBrowser: true
      })
      return

    } else if (this.engine === 'google') {

      this.google = new GoogleGenAI({ apiKey: this.config.engines.google.apiKey })
      return

    } else if (this.engine === 'lmstudio') {

      this.openai = new OpenAI({
        apiKey: this.config.engines.lmstudio.apiKey || 'lm-studio',
        baseURL: this.config.engines.lmstudio.baseURL || defaults.engines.lmstudio.baseURL,
        dangerouslyAllowBrowser: true
      })
      return

    } else if (this.engine === 'ollama') {

      this.ollama = new Ollama({
        host: this.config.engines.ollama.baseURL,
      })
      return

    // } else if (thibas.engine === 'fastembed') {

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

    } else if (llmManager.isCustomEngine(this.engine)) {

      const engineConfig = this.config.engines[this.engine] as CustomEngineConfig
      if (engineConfig.api === 'openai') {
        this.openai = new OpenAI({
          apiKey: engineConfig.apiKey,
          baseURL: engineConfig.baseURL,
          dangerouslyAllowBrowser: true
        })
        return
      }
    
    }

    // check
    throw new Error(`Unsupported embedding engine: ${this.engine}`)
  }

  async embed(texts: string[]): Promise<number[][]> {

    // openai
    if (this.openai) {
      const response = await this.openai.embeddings.create({ input: texts, model: this.model, })
      return response.data.map((item: Embedding) => item.embedding)
    }

    // google
    if (this.google) {
      try {
        const embeddings: number[][] = [] 
        for (const text of texts) {
          const response = await this.google.models.embedContent({
            model: this.model,
            contents: text
          })
          embeddings.push(response.embeddings[0].values)
        }
        return embeddings
      } catch (error) {
        if (this.model === 'gemini-embedding-exp') {
          console.error('[rag] google embedding error:', error)
          throw new Error('Gemini embedding model is not supported yet. Please use a different model.')
        } else {
          throw error
        }
      }
    }

    // ollama
    if (this.ollama) {
      const response = await this.ollama.embed({
        model: this.model,
        input: texts,
        keep_alive: '5m',
      })
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static isModelReady(app: App, engine: string, model: string): boolean {
    // if (engine === 'fastembed') {
    //   const modelFile = fastEmbedModelFile(app, model)
    //   return fs.existsSync(modelFile)
    // }
    return true
  }

}
