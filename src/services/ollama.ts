
import { store } from './store'
import LlmEngine from './engine'
import ollama from 'ollama'
import { Configuration, LLmCompletionPayload, LlmCompletionOpts, LlmResponse } from 'src'
import Message from 'src/models/message'

const visionModels = ['llava:latest', '*llava']

export default class extends LlmEngine {

  client: any

  constructor(config: Configuration) {
    super(config)
    this.client = ollama
    if (!this.client.chat) {
      // @ts-ignore
      this.client = ollama.default
    }
  }

  _isVisionModel(model: string) {
    return visionModels.includes(model) || model.includes('llava')
  }

  getRountingModel(): string {
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
    let model = opts?.model || this.config.ollama.model.chat
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

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<any> {

    // model: switch to vision if needed
    let model = opts?.model || this.config.ollama.model.chat
    if (this._requiresVisionModel(thread, model)) {
      let visionModel = this._findModel(store.config.ollama.models.chat, visionModels)
      if (visionModel) {
        model = visionModel.id
      }
    }
  
    // call
    console.log(`[ollama] prompting model ${model}`)
    let stream = this.client.chat({
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

  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse> {
    return null    
  }
}
