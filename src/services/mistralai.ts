import { LLmCompletionPayload, LlmCompletionOpts, LlmResponse, LlmStream } from '../index.d'
import { Configuration } from '../config.d'
import { store } from './store'
import LlmEngine from './engine'
//import MistralClient from '@mistralai/mistralai'
import Message from '../models/message'

const visionModels: string[] = []

export default class extends LlmEngine {

  //client: MistralClient

  constructor(config: Configuration) {
    super(config)
    //this.client = new MistralClient(config.engines.mistralai?.apiKey)
  }

  _isVisionModel(model: string) {
    return visionModels.includes(model)
  }

  getRountingModel(): string|null {
    return null
  }

  async getModels(): Promise<any[]> {
    return null
    // try {
    //   const response = await this.client.listModels()
    //   return response.data
    // } catch (error) {
    //   console.error('Error listing models:', error);
    // }
  }

  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {

    // // call
    // const model = opts?.model || this.config.engines.mistralai.model.chat
    // console.log(`[mistralai] prompting model ${model}`)
    // const response = await this.client.chat({
    //   model: model,
    //   messages: this._buildPayload(thread, model),
    // });

    // return an object
    return {
      type: 'text',
      content: 'Not implemented'//response.choices[0].message.content
    }
  }

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

    // // model: switch to vision if needed
    // let model = opts?.model || this.config.engines.mistralai.model.chat
    // if (this._requiresVisionModel(thread, model)) {
    //   const visionModel = this._findModel(store.config.engines.mistralai.models.chat, visionModels)
    //   if (visionModel) {
    //     model = visionModel.id
    //   }
    // }
  
    // // call
    // console.log(`[mistralai] prompting model ${model}`)
    // const stream = this.client.chatStream({
    //   model: model,
    //   messages: this._buildPayload(thread, model),
    // })

    // // done
    // return stream

    return null

  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async stop() {
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
