
import { LlmEngine, LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream, EngineCreateOpts } from 'multi-llm-ts'
import { store } from '../../src/services/store'
import Message from '../../src/models/message'
import { RandomChunkStream, InfiniteStream } from './streams'

export const setLlmDefaults = (engine: string, model: string) => {
  store.config.llm.engine = engine
  store.config.engines[engine] = {
    models: { chat: [] },
    model: { chat: model }
  }
}

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

  constructor(config: EngineCreateOpts) {
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
   
   
  async complete(model: string, thread: Message[]): Promise<LlmResponse> {
    // this is only used for titling so we pack all the processing that needs to be done:
    // remove <think> content, remove html and markdown, remove prefixes and quotes
    return {
      type: 'text',
      content: `<think>Reasoning...</think># <b>${thread[0].content}:\n"Title"</b>`,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async stream(model: string, thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

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

    // infinite
    if (thread[thread.length-1].content.includes('infinite')) {
      return new InfiniteStream()
    }

    // now stream
    return new RandomChunkStream(JSON.stringify([
      ...thread.map(m => {
        let content = m.contentForModel
        if (m.attachment?.content && m.attachment.isText()) {
          content += ` (${m.attachment.content})`
        }
        return { role: m.role, content: content }}),
      { role: 'assistant', content: 'Be kind. Don\'t mock me' }
    ]))
  }

  async stop() {
  }

  async *nativeChunkToLlmChunk(chunk: any): AsyncGenerator<LlmChunk, void, void> {
    if (chunk.toString('utf8') == '<DONE>') {
      yield {
        type: 'content',
        text: '',
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
    payload.images = [ message.attachment.content ]
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
