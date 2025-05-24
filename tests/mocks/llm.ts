
import { LlmEngine, LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStreamingResponse, EngineCreateOpts, ModelCapabilities, ChatModel } from 'multi-llm-ts'
import { store } from '../../src/services/store'
import Message from '../../src/models/message'
import { RandomChunkStream, InfiniteStream } from './streams'
import Attachment from '../../src/models/attachment'

export const setLlmDefaults = (engine: string, model: string) => {
  store.config.llm.engine = engine
  store.config.engines[engine] = {
    models: { chat: [
      { id: model, name: model, capabilities: { tools: true, vision: false, reasoning: false } }
    ] },
    model: { chat: model }
  }
}

export const installMockModels = () => {
  store.config.engines.mock = {
    label: 'mock_label',
    models: { chat: [
      { id: 'chat', meta: {}, capabilities: { tools: true, vision: false, reasoning: false } },
      { id: 'chat2', meta: {}, capabilities: { tools: true, vision: false, reasoning: false } },
      { id: 'vision', meta: {}, capabilities: { tools: true, vision: true, reasoning: false } },
    ] },
    model: { chat: 'chat', vision: 'vision' },
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

  getModelCapabilities(model: string): ModelCapabilities {
    return {
      tools: true,
      vision: model == 'vision',
      reasoning: model == 'reasoning',
    }
  }

  async getModels(): Promise<any[]> {
    return [
      { id: 'chat', name: 'Chat' },
      { id: 'image', name: 'Image' },
      { id: 'vision', name: 'Vision' }
    ]
  }
   
  async chat(model: ChatModel, thread: Message[]): Promise<LlmResponse> {
    // this is only used for titling so we pack all the processing that needs to be done:
    // remove <think> content, remove html and markdown, remove prefixes and quotes
    return {
      type: 'text',
      content: `<think>Reasoning...</think># <b>${thread[0].content}:\n"Title"</b>`,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async stream(model: ChatModel, thread: Message[], opts: LlmCompletionOpts): Promise<LlmStreamingResponse> {

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
      return { stream: new InfiniteStream(), context: {} }
    }

    // now stream
    return {
      stream: new RandomChunkStream(JSON.stringify([
        ...thread.map(m => {
          let content = m.contentForModel
          for (const attachment of m.attachments) {
            if (attachment?.content && attachment.isText()) {
              content += ` (${attachment.content})`
            }
          }
          return { role: m.role, content: content }}),
        { role: 'assistant', content: 'Be kind. Don\'t mock me' }
      ])),
      context: {}
    }
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

  addImageToPayload(attachment: Attachment, payload: LLmCompletionPayload) {
    payload.images = [ attachment.content ]
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
