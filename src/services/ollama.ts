
import { Configuration, LLmCompletionPayload, LlmCompletionOpts, LlmResponse, LlmStream } from '../index.d'
import { store } from './store'
import LlmEngine from './engine'
import ollama from 'ollama'
import Message from '../models/message'

const visionModels = ['llava:latest', '*llava']

export default class extends LlmEngine {

  client: any

  constructor(config: Configuration) {
    super(config)
    this.client = ollama
  }

  _isVisionModel(model: string) {
    return visionModels.includes(model) || model.includes('llava')
  }

  getRountingModel(): string|null {
    return null
  }

  async getModels() {
    try {
      const response = await this.client.list()
      return response.models
    } catch (error) {
      console.error('Error listing models:', error);
    }
  }

  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {

    // call
    const model = opts?.model || this.config.engines.ollama.model.chat
    console.log(`[ollama] prompting model ${model}`)
    const response = await this.client.chat({
      model: model,
      messages: this._buildPayload(thread, model),
      stream: false
    });

    // return an object
    return {
      type: 'text',
      content: response.message.content
    }
  }

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

    // model: switch to vision if needed
    let model = opts?.model || this.config.engines.ollama.model.chat
    if (this._requiresVisionModel(thread, model)) {
      const visionModel = this._findModel(store.config.engines.ollama.models.chat, visionModels)
      if (visionModel) {
        model = visionModel.id
      }
    }
  
    // call
    console.log(`[ollama] prompting model ${model}`)
    const stream = this.client.chat({
      model: model,
      messages: this._buildPayload(thread, model),
      stream: true,
    })

    // done
    return stream

  }

  async stop() {
    await ollama.abort()
  }

  processChunk(chunk: any) {
    return {
      text: chunk.message.content,
      done: chunk.done
    }
  }

  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
    payload.images = [ message.attachment.contents ]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse|null> {
    return null    
  }
}
