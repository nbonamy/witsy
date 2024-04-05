
import OpenAI from 'openai'
import LLmService from './llm_service'

export default class extends LLmService {

  constructor(config) {
    super(config)
    this.client = new OpenAI({
      apiKey: config.openAI.apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  getRountingModel() {
    return 'gpt-3.5-turbo'
  }

  async getModels() {
    try {
      const response = await this.client.models.list()
      return response.data
    } catch (error) {
      console.error('Error listing models:', error);
    }
  }

  async complete(thread, opts) {

    // call
    const response = await this.client.chat.completions.create({
      model: opts?.model || this.config.openAI.models.chat,
      messages: this._buildMessages(thread),
    });

    // return an object
    return {
      type: 'text',
      content: response.choices[0].message.content
    }
  }

  async stream(thread) {
    return this.client.chat.completions.create({
      model: this.config.openAI.models.chat,
      messages: this._buildMessages(thread),
      stream: true,
    })
  }

  processChunk(chunk) {
    return {
      text: chunk.choices[0]?.delta?.content || '',
      done: chunk.choices[0]?.finish_reason === 'stop'
    }
  }

  async image(prompt) {
    
    // call
    const response = await this.client.images.generate({
      model: this.config.openAI.models.image,
      prompt: prompt,
      n:1,
    })

    // return an object
    return {
      type: 'image',
      original_prompt: prompt,
      revised_prompt: response.data[0].revised_prompt,
      url: response.data[0].url,
    }

  }

}
