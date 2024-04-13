/* eslint-disable @typescript-eslint/no-unused-vars */
import { Message, LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream } from '../index.d'
import { EngineConfig, Configuration } from '../config.d'
import LlmEngine from './engine'
//import MistralClient from '@mistralai/mistralai'

export const isMistrailAIReady = (engineConfig: EngineConfig): boolean => {
  //return engineConfig.models.chat.length > 0
  return false
}

export default class extends LlmEngine {

  //client: MistralClient

  constructor(config: Configuration) {
    super(config)
    //this.client = new MistralClient(config.engines.mistralai?.apiKey)
  }

  getName(): string {
    return 'mistralai'
  }

  getVisionModels(): string[] {
    return []
  }

  isVisionModel(model: string): boolean {
    return this.getVisionModels().includes(model)
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
    //   messages: this.buildPayload(thread, model),
    // });

    // return an object
    return {
      type: 'text',
      content: 'Not implemented'//response.choices[0].message.content
    }
  }

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

    // // model: switch to vision if needed
    // const model = this.selectModel(thread, opts?.model || this.getChatModel())
  
    // // call
    // console.log(`[mistralai] prompting model ${model}`)
    // const stream = this.client.chatStream({
    //   model: model,
    //   messages: this.buildPayload(thread, model),
    // })

    // // done
    // return stream

    return null

  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async stop() {
  }

  streamChunkToLlmChunk(chunk: any): LlmChunk {
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
