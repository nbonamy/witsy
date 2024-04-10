
import { store } from './store'
import LlmEngine from './engine'
import ollama from 'ollama'

const visionModels = ['llava:latest', '*llava']

export default class extends LlmEngine {

  constructor(config) {
    super(config)
    this.ollama = ollama
    if (!this.ollama.chat) {
      this.ollama = ollama.default
    }
  }

  _isVisionModel(model) {
    return model.includes('llava')
  }

  getRountingModel() {
    return null
  }

  async getModels() {
    try {
      const response = await this.ollama.list()
      return response.models
    } catch (error) {
      console.error('Error listing models:', error);
    }
  }

  async complete(thread, opts) {

    // call
    let model = opts?.model || this.config.ollama.model.chat
    console.log(`[ollama] prompting model ${model}`)
    const response = await this.ollama.chat({
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

  async stream(thread, opts) {

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
    let stream = this.ollama.chat({
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

  processChunk(chunk) {
    return {
      text: chunk.message.content,
      done: chunk.done
    }
  }

  addImageToPayload(message, payload) {
    payload.images = [ message.attachment.contents ]
  }

  async image(prompt) {
    return null    
  }
}
