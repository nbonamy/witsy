/* eslint-disable @typescript-eslint/no-unused-vars */

import { LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream, Message } from '../../src/index.d'
import LlmEngine from '../../src/services/engine'
import RandomChunkStream from './stream'

export default class LlmMock extends LlmEngine {

  constructor() {
    super(null)
  }

  isVisionModel(model: string): boolean {
    return model == 'vision'
  }

  getRountingModel(): string|null {
    return null
  }

  async getModels(): Promise<any[]> {
    return [
      { id: 'chat', name: 'Chat' },
      { id: 'image', name: 'Image' },
      { id: 'vision', name: 'Vision' }
    ]
  }

  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {
    return {
      type: 'text',
      content: 'Be kind. Don\'t mock me'
    }
  }

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {
    return new RandomChunkStream(JSON.stringify([
      ...thread.map(m => { return { role: m.role, content: m.content }}),
      { role: 'assistant', content: 'Be kind. Don\'t mock me' }
    ]))
  }

  async stop(stream: RandomChunkStream) {
    stream.destroy()
  }

  streamChunkToLlmChunk(chunk: any): LlmChunk {
    if (chunk.toString('utf8') == 'DONE') {
      return {
        text: null,
        done: true
      }
    } else {
      return {
        text: chunk?.toString('utf8'),
        done: chunk == null
      }
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

