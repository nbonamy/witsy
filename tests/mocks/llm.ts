/* eslint-disable @typescript-eslint/no-unused-vars */

import { Message } from '../../src/types/index.d'
import { LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmEventCallback, LlmResponse, LlmStream } from '../../src/types/llm.d'
import { Configuration } from '../../src/types/config.d'
import LlmEngine from '../../src/services/engine'
import RandomChunkStream from './stream'

export default class LlmMock extends LlmEngine {

  constructor(config: Configuration) {
    super(config)
  }

  getName(): string {
    return 'mock'
  }

  isVisionModel(model: string): boolean {
    return model == 'vision'
  }

  getRountingModel(): string|null {
    return 'chat'
  }

  async getModels(): Promise<any[]> {
    return [
      { id: 'chat', name: 'Chat' },
      { id: 'image', name: 'Image' },
      { id: 'vision', name: 'Vision' }
    ]
  }

  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {

    // routing
    if (thread[0].content.includes('routing')) {
      if (thread[1].content.includes('image')) {
        return { type: 'text', content: 'IMAGE' }
      }
      return { type: 'text', content: 'TEXT' }
    }

    return {
      type: 'text',
      content: JSON.stringify([
        ...thread.map(m => { return { role: m.role, content: m.content }}),
        { role: 'assistant', content: 'Be kind. Don\'t mock me' }
      ])
    }
  }

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

    // model: switch to vision if needed
    const model = this.selectModel(thread, opts?.model || this.getChatModel())

    // build payload
    const payload = this.buildPayload(thread, model)

    // now stream
    return new RandomChunkStream(JSON.stringify([
      ...thread.map(m => { return { role: m.role, content: m.content }}),
      { role: 'assistant', content: 'Be kind. Don\'t mock me' }
    ]))
  }

  async stop(stream: RandomChunkStream) {
    stream.destroy()
  }

  async streamChunkToLlmChunk(chunk: any, eventCallback: LlmEventCallback): Promise<LlmChunk|null> {
    if (chunk.toString('utf8') == '<DONE>') {
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
    return {
      type: 'image',
      original_prompt: prompt,
      content: 'image_content'
    }
  }

}

