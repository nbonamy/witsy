
import { Message, LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream } from '../index.d'
import { Configuration } from '../config.d'
import { store } from './store'
import LlmEngine from './engine'
import OpenAI from 'openai'
import { ChatCompletionChunk } from 'openai/resources'
import { Stream } from 'openai/streaming'

const visionModels: string[] = ['gpt-4-turbo', 'gpt-4-vision', 'gpt-4-vision-preview', '*vision']

export default class extends LlmEngine {

  client: OpenAI

  constructor(config: Configuration) {
    super(config)
    this.client = new OpenAI({
      apiKey: config.engines.openai.apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  _isVisionModel(model: string) {
    return visionModels.includes(model) || model.includes('vision')
  }

  getRountingModel(): string|null {
    return 'gpt-3.5-turbo'
  }

  async getModels(): Promise<any[]> {
    try {
      const response = await this.client.models.list()
      return response.data
    } catch (error) {
      console.error('Error listing models:', error);
    }
  }

  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {

    // call
    const model = opts?.model || this.config.engines.openai.model.chat
    console.log(`[openai] prompting model ${model}`)
    const response = await this.client.chat.completions.create({
      model: model,
      messages: this._buildPayload(thread, model) as Array<any>
    });

    // return an object
    return {
      type: 'text',
      content: response.choices[0].message.content
    }
  }

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

    // model: switch to vision if needed
    let model = opts?.model || this.config.engines.openai.model.chat
    if (this._requiresVisionModel(thread, model)) {
      const visionModel = this._findModel(store.config.engines.openai.models.chat, visionModels)
      if (visionModel) {
        model = visionModel.id
      }
    }

    // call
    console.log(`[openai] prompting model ${model}`)
    const stream = this.client.chat.completions.create({
      model: model,
      messages: this._buildPayload(thread, model) as Array<any>,
      stream: true,
    })

    // done
    return stream

  }

  async stop(stream: Stream<any>) {
    await stream?.controller?.abort()
  }

  streamChunkToLlmChunk(chunk: ChatCompletionChunk): LlmChunk {
    return {
      text: chunk.choices[0]?.delta?.content || '',
      done: chunk.choices[0]?.finish_reason === 'stop'
    }
  }

  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
    payload.content = [
      { type: 'text', text: message.content },
      { type: 'image_url', image_url: {
        url: 'data:image/jpeg;base64,' + message.attachment.contents,
      }}
    ]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse> {
    
    // call
    const model = this.config.engines.openai.model.image
    console.log(`[openai] prompting model ${model}`)
    const response = await this.client.images.generate({
      model: model,
      prompt: prompt,
      response_format: 'b64_json',
      size: opts?.size,
      style: opts?.style,
      n: opts?.n || 1,
    })

    // return an object
    return {
      type: 'image',
      original_prompt: prompt,
      revised_prompt: response.data[0].revised_prompt,
      url: response.data[0].url,
      content: response.data[0].b64_json,
    }

  }

}
