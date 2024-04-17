
import { Message } from '../types/index.d'
import { LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream, LlmEventCallback } from '../types/llm.d'
import { EngineConfig, Configuration } from '../types/config.d'
import LlmEngine from './engine'
import ollama, { ChatResponse } from 'ollama'

export const isOllamaReady = (engineConfig: EngineConfig): boolean => {
  return engineConfig.models.chat.length > 0
}

export default class extends LlmEngine {

  client: any

  constructor(config: Configuration) {
    super(config)
    this.client = ollama
  }

  getName(): string {
    return 'ollama'
  }

  getVisionModels(): string[] {
    return ['llava:latest', '*llava']
  }

  isVisionModel(model: string): boolean {
    return this.getVisionModels().includes(model) || model.includes('llava')
  }

  getRountingModel(): string|null {
    return null
  }

  async getModels(): Promise<any[]> {
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
      messages: this.buildPayload(thread, model),
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
    const model = this.selectModel(thread, opts?.model || this.getChatModel())
  
    // call
    console.log(`[ollama] prompting model ${model}`)
    const stream = this.client.chat({
      model: model,
      messages: this.buildPayload(thread, model),
      stream: true,
    })

    // done
    return stream

  }

  async stop() {
    await ollama.abort()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async streamChunkToLlmChunk(chunk: ChatResponse, eventCallback: LlmEventCallback): Promise<LlmChunk|null> {
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
