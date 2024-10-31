
import { LlmEngine, LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream, EngineConfig } from 'multi-llm-ts'
import Message from '../../src/models/message'
import RandomChunkStream from './stream'

class LlmError extends Error {

  name: string
  status: number
  message: string

  constructor(name: string, status: number, message: string) {
    super()
    this.name = name
    this.status = status
    this.message = message
  }
}

export default class LlmMock extends LlmEngine {

  constructor(config: EngineConfig) {
    super(config)
  }

  getName(): string {
    return 'mock'
  }

  isVisionModel(model: string): boolean {
    return model == 'vision'
  }

  async getModels(): Promise<any[]> {
    return [
      { id: 'chat', name: 'Chat' },
      { id: 'image', name: 'Image' },
      { id: 'vision', name: 'Vision' }
    ]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {
    return {
      type: 'text',
      content: JSON.stringify([
        ...thread.map(m => { return { role: m.role, content: m.content }}),
        { role: 'assistant', content: 'Be kind. Don\'t mock me' }
      ])
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

    // errors
    if (thread[thread.length-1].content.includes('no api key')) {
      throw new LlmError('NoApiKeyError', 401, 'Missing apiKey')
    }
    if (thread[thread.length-1].content.includes('no credit')) {
      throw new LlmError('LowBalanceError', 400, 'Your balance is too low')
    }
    if (thread[thread.length-1].content.includes('quota')) {
      throw new LlmError('QuotaExceededError', 429, 'You have exceeded your quota')
    }

    // now stream
    return new RandomChunkStream(JSON.stringify([
      ...thread.map(m => { return { role: m.role, content: m.content }}),
      { role: 'assistant', content: 'Be kind. Don\'t mock me' }
    ]))
  }

  async stop(stream: RandomChunkStream) {
    stream.destroy()
  }

  async *nativeChunkToLlmChunk(chunk: any): AsyncGenerator<LlmChunk, void, void> {
    if (chunk.toString('utf8') == '<DONE>') {
      yield {
        type: 'content',
        done: true
      }
    } else {
      yield {
        type: 'content',
        text: chunk?.toString('utf8'),
        done: chunk == null
      }
    }
  }

  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
    payload.images = [ message.attachment.contents ]
  }

   
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse> {
    return {
      type: 'image',
      original_prompt: prompt,
      content: 'image_content'
    }
  }

}
