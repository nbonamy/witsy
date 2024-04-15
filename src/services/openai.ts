
import { Message, LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream, LlmToolCall } from '../index.d'
import { EngineConfig, Configuration } from '../config.d'
import LlmEngine from './engine'
import OpenAI from 'openai'
import { ChatCompletionChunk } from 'openai/resources'
import { Stream } from 'openai/streaming'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const isOpenAIReady = (engineConfig: EngineConfig): boolean => {
  // this is the default so pretend it is always ready
  return true
}

export default class extends LlmEngine {

  client: OpenAI
  currentModel: string
  currentThread: Array<any>
  toolCalls: LlmToolCall[]

  constructor(config: Configuration) {
    super(config)
    this.client = new OpenAI({
      apiKey: config.engines.openai.apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  getName(): string {
    return 'openai'
  }

  getVisionModels(): string[] {
    return ['gpt-4-turbo', 'gpt-4-vision', 'gpt-4-vision-preview', '*vision']
  }

  isVisionModel(model: string): boolean {
    return this.getVisionModels().includes(model) || model.includes('vision')
  }

  getRountingModel(): string | null {
    return 'gpt-3.5-turbo'
  }

  async getModels(): Promise<any[]> {

    // need an api key
    if (!this.client.apiKey) {
      return null
    }

    // do it
    try {
      const response = await this.client.models.list()
      return response.data
    } catch (error) {
      console.error('Error listing models:', error);
    }
  }

  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {

    // call
    const model = opts?.model || this.config.engines.openai.model.chat
    console.log(`[openai] prompting model ${model}`)
    const response = await this.client.chat.completions.create({
      model: model,
      messages: this.buildPayload(thread, model) as Array<any>
    });

    // return an object
    return {
      type: 'text',
      content: response.choices[0].message.content
    }
  }

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

    // model: switch to vision if needed
    this.currentModel = this.selectModel(thread, opts?.model || this.getChatModel())

    // save the message thread
    this.currentThread = this.buildPayload(thread, this.currentModel)
    return await this.doStream()

  }

  async doStream(): Promise<LlmStream> {

    // reset
    this.toolCalls = []

    // tools
    const tools = this.getAvailableTools()

    // call
    console.log(`[openai] prompting model ${this.currentModel}`)
    const stream = this.client.chat.completions.create({
      model: this.currentModel,
      messages: this.currentThread,
      stream: true,
      tools: tools.length ? tools : null,
      tool_choice: tools.length ? 'auto' : null,
    })

    // done
    return stream

  }

  async stop(stream: Stream<any>) {
    await stream?.controller?.abort()
  }

  async streamChunkToLlmChunk(chunk: ChatCompletionChunk): Promise<LlmChunk|null> {

    // tool calls
    if (chunk.choices[0]?.delta?.tool_calls) {

      // arguments or new tool?
      if (chunk.choices[0].delta.tool_calls[0].id) {

        // debug
        //console.log('[openai] tool call start:', chunk)

        // record the tool call
        const toolCall: LlmToolCall = {
          id: chunk.choices[0].delta.tool_calls[0].id,
          message: chunk.choices[0].delta.tool_calls.map((tc: any) => {
            delete tc.index
            return tc
          }),
          function: chunk.choices[0].delta.tool_calls[0].function.name,
          args: chunk.choices[0].delta.tool_calls[0].function.arguments,
        }
        this.toolCalls.push(toolCall)
        return null
      
      } else {

        const toolCall = this.toolCalls[this.toolCalls.length-1]
        toolCall.args += chunk.choices[0].delta.tool_calls[0].function.arguments
        return null

      }

    }

    // tool calls again
    if (chunk.choices[0]?.finish_reason === 'tool_calls') {

      // add tools
      for (const toolCall of this.toolCalls) {
        const args = JSON.parse(toolCall.args)
        const content = await this.callTool(toolCall.function, args)
        console.log(`[openai] tool call ${toolCall.function} with ${JSON.stringify(args)} => ${JSON.stringify(content).substring(0, 128)}`)
        this.currentThread.push({
          role: 'assistant',
          tool_calls: toolCall.message
        })
        this.currentThread.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function,
          content: JSON.stringify(content)
        })
      }

      // switch to new stream
      return {
        text: null,
        done: false,
        stream: await this.doStream()
      }
      
    }

    // text chunk
    return {
      text: chunk.choices[0]?.delta?.content || '',
      done: chunk.choices[0]?.finish_reason === 'stop'
    }
  }

  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
    payload.content = [
      { type: 'text', text: message.content },
      {
        type: 'image_url', image_url: {
          url: 'data:image/jpeg;base64,' + message.attachment.contents,
        }
      }
    ]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse> {

    // call
    const model = this.config.engines.openai.model.image
    console.log(`[openai] prompting model ${model}`)
    const response = await this.client.images.generate({
      model: model,
      prompt: prompt,
      response_format: 'b64_json',
      size: opts?.size,
      style: opts?.style,
      n: opts?.n || 1,
    })

    // return an object
    return {
      type: 'image',
      original_prompt: prompt,
      revised_prompt: response.data[0].revised_prompt,
      url: response.data[0].url,
      content: response.data[0].b64_json,
    }

  }

}
