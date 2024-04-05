import ollama from 'ollama'

export default class {

  constructor(config) {
    this.config = config
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

  processChunk(chunk) {
    return {
      text: chunk.message.content,
      done: chunk.done
    }
  }

  async image(prompt) {
    return null    
  }

  _buildMessages(thread) {
    if (typeof thread === 'string') {
      return [{ role: 'user', content: thread }]
    } else {
      return thread.filter((msg) => msg.type === 'text' && msg.content !== null).map((msg) => {
        return { role: msg.role, content: msg.content }
      })
    }
  }

}
