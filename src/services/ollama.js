
import ollama from 'ollama'
import LLmService from './llm_service'

export default class extends LLmService {

  constructor(config) {
    super(config)
  }

  hasVision() {
    return this.config.ollama.models.chat.includes('llava')
  }

  getRountingModel() {
    return null
  }

  async getModels() {
    try {
      const response = await ollama.list()
      return response.models
    } catch (error) {
      console.error('Error listing models:', error);
    }
  }

  async complete(thread, opts) {

    // call
    const response = await ollama.chat({
      model: opts?.model || this.config.ollama.models.chat,
      messages: this._buildMessages(thread),
      stream: false
    });

    // return an object
    return {
      type: 'text',
      content: response.message.content
    }
  }

  async stream(thread) {
    return ollama.chat({
      model: this.config.ollama.models.chat,
      messages: this._buildMessages(thread),
      stream: true,
    })
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
