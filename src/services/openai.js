
import { store } from './store'
import LlmEngine from './engine'
import OpenAI from 'openai'

const visionModels = ['gpt-4-turbo', 'gpt-4-vision', 'gpt-4-vision-preview', '*vision']

export default class extends LlmEngine {

  constructor(config) {
    super(config)
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  _isVisionModel(model) {
    return visionModels.includes(model) || model.includes('vision')
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
    let model = opts?.model || this.config.openai.model.chat
    console.log(`[openai] prompting model ${model}`)
    const response = await this.client.chat.completions.create({
      model: model,
      messages: this._buildPayload(thread, model),
    });

    // return an object
    return {
      type: 'text',
      content: response.choices[0].message.content
    }
  }

  async stream(thread, opts) {

    // model: switch to vision if needed
    let model = opts?.model || this.config.openai.model.chat
    if (this._requiresVisionModel(thread, model)) {
      let visionModel = this._findModel(store.config.openai.models.chat, visionModels)
      if (visionModel) {
        model = visionModel.id
      }
    }

    // call
    console.log(`[openai] prompting model ${model}`)
    let stream = this.client.chat.completions.create({
      model: model,
      messages: this._buildPayload(thread, model),
      stream: true,
    })

    // done
    return stream

  }

  async stop(stream) {
    await stream?.controller?.abort()
  }

  processChunk(chunk) {
    return {
      text: chunk.choices[0]?.delta?.content || '',
      done: chunk.choices[0]?.finish_reason === 'stop'
    }
  }

  addImageToPayload(message, payload) {
    payload.content = [
      { type: 'text', text: message.content },
      { type: 'image_url', image_url: {
        url: 'data:image/jpeg;base64,' + message.attachment.contents,
      }}
    ]
  }

  async image(prompt, opts) {
    
    // call
    let model = this.config.openai.model.image
    console.log(`[openai] prompting model ${model}`)
    const response = await this.client.images.generate({
      model: model,
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
