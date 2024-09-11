/* eslint-disable @typescript-eslint/no-unused-vars */
import { Message } from '../types/index.d'
import { LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream, LlmEventCallback, LlmToolCall } from '../types/llm.d'
import { EngineConfig, Configuration } from '../types/config.d'
import LlmEngine from './engine'

// until https://github.com/mistralai/client-js/issues/59 is fixed
//import MistralClient from '@mistralai/mistralai'
import MistralClient from '../vendor/mistralai'

export const isMistrailAIReady = (engineConfig: EngineConfig): boolean => {
  return engineConfig?.apiKey?.length > 0 && engineConfig?.models?.chat?.length > 0
}

export default class extends LlmEngine {

  client: MistralClient
  currentModel: string
  currentThread: Array<any>
  toolCalls: LlmToolCall[]

  constructor(config: Configuration) {
    super(config)
    this.client = new MistralClient(config.engines.mistralai?.apiKey || '')
  }

  getName(): string {
    return 'mistralai'
  }

  getVisionModels(): string[] {
    return []
  }

  async getModels(): Promise<any[]> {

    // need an api key
    if (!this.client.apiKey) {
      return null
    }

    // do it
    try {
      const response = await this.client.listModels()
      return response.data
    } catch (error) {
      console.error('Error listing models:', error);
    }
  }

  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {

    // call
    const model = opts?.model || this.config.engines.mistralai.model.chat
    console.log(`[mistralai] prompting model ${model}`)
    const response = await this.client.chat({
      model: model,
      messages: this.buildPayload(thread, model),
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
    const tools = this.getAvailableToolsForModel(this.currentModel)

    // call
    console.log(`[mistralai] prompting model ${this.currentModel}`)
    const stream = this.client.chatStream({
      model: this.currentModel,
      messages: this.currentThread,
      tools: tools.length ? tools : null,
      tool_choice: tools.length ? 'any' : null,
    })

    // done
    return stream

  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async stop() {
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async streamChunkToLlmChunk(chunk: any, eventCallback: LlmEventCallback): Promise<LlmChunk|null> {
    
    // tool calls
    if (chunk.choices[0]?.delta?.tool_calls) {

      // arguments or new tool?
      if (chunk.choices[0].delta.tool_calls[0].id) {

        // debug
        //console.log('[mistralai] tool call start:', chunk)

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
        console.log('[mistralai] tool call:', toolCall)
        this.toolCalls.push(toolCall)

        // first notify
        eventCallback?.call(this, {
          type: 'tool',
          content: this.getToolPreparationDescription(toolCall.function)
        })

      } else {

        const toolCall = this.toolCalls[this.toolCalls.length-1]
        toolCall.args += chunk.choices[0].delta.tool_calls[0].function.arguments
        return null

      }

    }

    // now tool calling
    if (chunk.choices[0]?.finish_reason === 'tool_calls') {

      // debug
      //console.log('[mistralai] tool calls:', this.toolCalls)

      // add tools
      for (const toolCall of this.toolCalls) {

        // first notify
        eventCallback?.call(this, {
          type: 'tool',
          content: this.getToolRunningDescription(toolCall.function)
        })

        // now execute
        const args = JSON.parse(toolCall.args)
        const content = await this.callTool(toolCall.function, args)
        console.log(`[mistralai] tool call ${toolCall.function} with ${JSON.stringify(args)} => ${JSON.stringify(content).substring(0, 128)}`)

        // add tool call message
        this.currentThread.push({
          role: 'assistant',
          tool_calls: toolCall.message
        })

        // add tool response message
        this.currentThread.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function,
          content: JSON.stringify(content)
        })
      }

      // clear
      eventCallback?.call(this, {
        type: 'tool',
        content: null,
      })

      // switch to new stream
      eventCallback?.call(this, {
        type: 'stream',
        content: await this.doStream(),
      })

      // done
      return null
      
    }

    // default
    return {
      text: chunk.choices[0].delta.content,
      done: chunk.choices[0].finish_reason != null
    }
  }

  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
    payload.images = [ message.attachment.contents ]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse|null> {
    return null    
  }

  getAvailableToolsForModel(model: string): any[] {
    if (model.includes('mistral-large') || model.includes('mixtral-8x22b')) {
      return this.getAvailableTools()
    } else {
      return []
    }
  }
}
