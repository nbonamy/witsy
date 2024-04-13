
import { Message, LlmResponse, LlmCompletionOpts, LLmCompletionPayload, LlmStream, LlmChunk } from '../index.d'
import { Configuration, Model } from '../config.d'
import { getFileContents } from './download'

export default class LlmEngine {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _isVisionModel(model: string): boolean {
    return false
  }

  _requiresVisionModel(thread: Message[], currentModel: string) {
    
    // if we already have a vision or auto switch is disabled
    if (this._isVisionModel(currentModel) || !this.config.llm.autoVisionSwitch) {
      return false
    }

    // check if amy of the messages in the thread have an attachment
    return thread.some((msg) => msg.attachment)

  }

  _findModel(models: Model[], filters: string[]) {
    for (const filter of filters) {
      if (filter.startsWith('*')) {
        const matches = models.filter((m) => !m.id.includes(filter.substring(1)))
        if (matches.length > 0) return matches[0]
      } else {
        const model = models.find((m) => m.id == filter)
        if (model) return model
      }
    }
    return null
  }

  _buildPayload(thread: Message[], model: string): LLmCompletionPayload[] {
    if (typeof thread === 'string') {
      return [{ role: 'user', content: thread }]
    } else {

      // we only want to upload the last attchment
      // sp build messages in reverse order
      // and then rerse the array

      let attached = false
      return thread.toReversed().filter((msg) => msg.type === 'text' && msg.content !== null).map((msg): LLmCompletionPayload => {
        const payload: LLmCompletionPayload = { role: msg.role, content: msg.content }
        if (!attached && msg.attachment && this._isVisionModel(model)) {
          
          // tis can be a loaded chat where contents is not present
          if (!msg.attachment.contents) {
            msg.attachment.contents = getFileContents(msg.attachment.url).contents
          }

          // now we can attach
          this.addImageToPayload(msg, payload)
          attached = true

        }
        return payload
      }).reverse()
    }
  }

  async getModels(): Promise<any[]> {
    throw new Error('Not implemented')
  }
  
  getRountingModel(): string|null {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse> {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async stop(stream: any): Promise<void> {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  streamChunkToLlmChunk(chunk: any): LlmChunk {
    throw new Error('Not implemented')
  }

}
