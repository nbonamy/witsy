
import { Message, LlmResponse, LlmCompletionOpts, LLmCompletionPayload, LlmStream, LlmChunk } from '../index.d'
import { Configuration, Model } from '../config.d'
import { getFileContents } from './download'

export default class LlmEngine {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  getName(): string {
    throw new Error('Not implemented')
  }

  getVisionModels(): string[] {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isVisionModel(model: string): boolean {
    return false
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

  getChatModel(): string {
    return this.config.engines[this.getName()].model.chat
  }

  getChatModels(): Model[] {
    return this.config.engines[this.getName()].models.chat
  }

  requiresVisionModelSwitch(thread: Message[], currentModel: string): boolean {
    
    // if we already have a vision or auto switch is disabled
    if (this.isVisionModel(currentModel) || !this.config.llm.autoVisionSwitch) {
      return false
    }

    // check if amy of the messages in the thread have an attachment
    return thread.some((msg) => msg.attachment)

  }

  findModel(models: Model[], filters: string[]): Model|null {
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

  selectModel(thread: Message[], currentModel: string): string {

    // if we need to switch to vision
    if (this.requiresVisionModelSwitch(thread, currentModel)) {

      // find the vision model
      const visionModel = this.findModel(this.getChatModels(), this.getVisionModels())
      if (visionModel) {
        return visionModel.id
      }
    }

    // no need to switch
    return currentModel

  }

  buildPayload(thread: Message[], model: string): LLmCompletionPayload[] {
    if (typeof thread === 'string') {
      return [{ role: 'user', content: thread }]
    } else {

      // we only want to upload the last attchment
      // sp build messages in reverse order
      // and then rerse the array

      let attached = false
      return thread.toReversed().filter((msg) => msg.type === 'text' && msg.content !== null).map((msg): LLmCompletionPayload => {
        const payload: LLmCompletionPayload = { role: msg.role, content: msg.content }
        if (!attached && msg.attachment && this.isVisionModel(model)) {
          
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

}
