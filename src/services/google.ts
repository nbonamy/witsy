
import { Message } from 'types/index.d'
import { EngineConfig, Configuration } from 'types/config.d'
import { LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream, LlmToolCall, LlmEventCallback } from 'types/llm.d'
import { Content, EnhancedGenerateContentResponse, GenerativeModel, GoogleGenerativeAI, ModelParams, Part } from '@google/generative-ai'
import { getFileContents } from './download'
import Attachment from '../models/attachment'
import LlmEngine from './engine'

export const isGoogleConfigured = (engineConfig: EngineConfig): boolean => {
  return engineConfig?.apiKey?.length > 0
}

export const isGoogleReady = (engineConfig: EngineConfig): boolean => {
  return isGoogleConfigured(engineConfig) && engineConfig?.models?.chat?.length > 0
}

export default class extends LlmEngine {

  client: GoogleGenerativeAI
  toolCalls: LlmToolCall[]

  constructor(config: Configuration) {
    super(config)
    this.client = new GoogleGenerativeAI(
      config.engines.google.apiKey,
    )
  }

  getName(): string {
    return 'google'
  }

  getVisionModels(): string[] {
    return ['gemini-1.5-flash-latest', 'models/gemini-1.5-pro-latest', 'models/gemini-pro-vision', '*vision*']
  }

  async getModels(): Promise<any[]> {

    // need an api key
    if (!this.client.apiKey) {
      return null
    }

    // do it
    return [
      { id: 'models/gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash-latest', name: 'Gemini  1.5 Flash' },
      { id: 'models/gemini-pro', name: 'Gemini 1.0 Pro' },
      //{ id: 'models/gemini-pro-vision', name: 'Gemini Pro Vision' },
    ]
  }


  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {

    // call
    const modelName = opts?.model || this.config.engines.google.model.chat
    console.log(`[google] prompting model ${modelName}`)
    const model = await this.getModel(modelName, thread[0].content)
    const chatSession = model.startChat({
      history: this.threadToHistory(thread, modelName)
    })

    // done
    const result = await chatSession.sendMessage(this.getPrompt(thread))
    return {
      type: 'text',
      content: result.response.text()
    }
  }

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

    // model: switch to vision if needed
    const modelName = this.selectModel(thread, opts?.model || this.getChatModel())

    // reset
    this.toolCalls = []

    // call
    console.log(`[google] prompting model ${modelName}`)
    const model = await this.getModel(modelName, thread[0].content)
    const chatSession = model.startChat({
      history: this.threadToHistory(thread, modelName)
    })

    // done
    const result = await chatSession.sendMessageStream(this.getPrompt(thread))
    return result.stream

  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getModel(model: string, instructions: string): Promise<GenerativeModel> {

    // not all models have all features
    const hasInstructions = !(['models/gemini-pro', 'gemini-1.5-flash'].includes(model))
    const hasTools = false

    // model params
    const modelParams: ModelParams = {
      model: model,
    }

    // add instructions
    if (hasInstructions) {
      modelParams.systemInstruction = instructions
    }

    // add tools
    if (hasTools) {
      modelParams.tools = [{
        functionDeclarations: (await this.getAvailableTools()).map((tool) => {
          return tool.function
        })
      }]
    }

    // call
    return this.client.getGenerativeModel( modelParams, {
      apiVersion: 'v1beta'
    })
  }

  getPrompt(thread: Message[]): Array<string | Part> {
    
    // init
    const prompt = []
    const lastMessage = thread[thread.length-1]

    // content
    prompt.push(lastMessage.content)

    // attachment
    if (lastMessage.attachment) {
      this.addAttachment(prompt, lastMessage.attachment)
    }

    // done
    return prompt
  } 

  threadToHistory(thread: Message[], modelName: string): Content[] {
    const payload = this.buildPayload(thread.slice(1, -1), modelName)
    return payload.map((message) => this.messageToContent(message))
  }

  messageToContent(payload: LLmCompletionPayload): Content {
    const content: Content = {
      role: payload.role == 'assistant' ? 'model' : payload.role,
      parts: [ { text: payload.content } ]
    }
    for (const index in payload.images) {
      content.parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: payload.images[index],
        }
      })
    }
    return content
  }

  addAttachment(parts: Array<string | Part>, attachment: Attachment) {

    // load if no contents
    if (!attachment.contents) {
      attachment.contents = getFileContents(attachment.url).contents
    }
  
    // add inline
    if (attachment.isImage()) {
      parts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.contents,
        }
      })
    } else if (attachment.isText()) {
      parts.push(attachment.contents)
    }

  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async stop(stream: AsyncGenerator<any>) {
    //await stream?.controller?.abort()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async streamChunkToLlmChunk(chunk: EnhancedGenerateContentResponse, eventCallback: LlmEventCallback): Promise<LlmChunk|null> {

    //console.log('[google] chunk:', chunk)

    // // tool calls
    // const toolCalls = chunk.functionCalls()
    // if (toolCalls?.length) {

    //   // save
    //   this.toolCalls = toolCalls.map((tc) => {
    //     return {
    //       id: tc.name,
    //       message: '',
    //       function: tc.name,
    //       args: JSON.stringify(tc.args),
    //     }
    //   })

    //   // call
    //   for (const toolCall of this.toolCalls) {

    //     // first notify
    //     eventCallback?.call(this, {
    //       type: 'tool',
    //       content: this.getToolPreparationDescription(toolCall.function)
    //     })

    //     // first notify
    //     eventCallback?.call(this, {
    //       type: 'tool',
    //       content: this.getToolRunningDescription(toolCall.function)
    //     })

    //     // now execute
    //     const args = JSON.parse(toolCall.args)
    //     const content = await this.callTool(toolCall.function, args)
    //     console.log(`[google] tool call ${toolCall.function} with ${JSON.stringify(args)} => ${JSON.stringify(content).substring(0, 128)}`)

    //     // send
    //     this.currentChat.sendMessageStream([
    //       { functionResponse: {
    //         name: toolCall.function,
    //         response: content
    //       }}
    //     ])

    //     // clear
    //     eventCallback?.call(this, {
    //       type: 'tool',
    //       content: null,
    //     })

    //   }

    //   // done
    //   return null
      
    // }

    // text chunk
    return {
      text: chunk.text(),
      done: chunk.candidates[0].finishReason === 'STOP'
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
    payload.images = [ message.attachment.contents ]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse> {
    return null    
  }

}
