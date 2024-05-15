
import { Message } from '../types/index.d'
import { EngineConfig, Configuration } from '../types/config.d'
import { LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream, LlmToolCall, LlmEventCallback } from '../types/llm.d'
import { ChatSession, Content, EnhancedGenerateContentResponse, GenerativeModel, GoogleGenerativeAI, ModelParams, Part } from '@google/generative-ai'
import { getFileContents } from './download'
import LlmEngine from './engine'

export const isGoogleReady = (engineConfig: EngineConfig): boolean => {
  return engineConfig.apiKey?.length > 0
}

export default class extends LlmEngine {

  client: GoogleGenerativeAI
  currentChat: ChatSession
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

  isVisionModel(model: string): boolean {
    return this.getVisionModels().includes(model)
  }

  getRountingModel(): string | null {
    return null
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
    const modelName = opts?.model || this.config.engines.openai.model.chat
    console.log(`[openai] prompting model ${modelName}`)
    const model = this.getModel(modelName, thread[0].content)
    const chat = model.startChat({
      history: thread.slice(1, -1).map((message) => this.messageToContent(message))
    })

    // done
    const result = await chat.sendMessage(this.getPrompt(thread))
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

    // save the message thread
    const payload = this.buildPayload(thread, modelName)

    // call
    console.log(`[openai] prompting model ${modelName}`)
    const model = this.getModel(modelName, payload[0].content)
    this.currentChat = model.startChat({
      history: payload.slice(1, -1).map((message) => this.messageToContent(message))
    })

    // done
    const result = await this.currentChat.sendMessageStream(this.getPrompt(thread))
    return result.stream

  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getModel(model: string, instructions: string): GenerativeModel {

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
        functionDeclarations: this.getAvailableTools().map((tool) => {
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

    // image
    if (lastMessage.attachment) {

      // load if no contents
      if (!lastMessage.attachment.contents) {
        lastMessage.attachment.contents = getFileContents(lastMessage.attachment.url).contents
      }
    
      // add inline
      prompt.push({
        inlineData: {
          mimeType: 'image/png',
          data: lastMessage.attachment.contents,
        }
      })

    }

    // done
    return prompt
  } 

  messageToContent(message: any): Content {
    return {
      role: message.role == 'assistant' ? 'model' : message.role,
      parts: [ { text: message.content } ]
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async stop(stream: AsyncGenerator<any>) {
    //await stream?.controller?.abort()
  }

  async streamChunkToLlmChunk(chunk: EnhancedGenerateContentResponse, eventCallback: LlmEventCallback): Promise<LlmChunk|null> {

    //console.log('[google] chunk:', chunk)

    // tool calls
    const toolCalls = chunk.functionCalls()
    if (toolCalls?.length) {

      // save
      this.toolCalls = toolCalls.map((tc) => {
        return {
          id: tc.name,
          message: '',
          function: tc.name,
          args: JSON.stringify(tc.args),
        }
      })

      // call
      for (const toolCall of this.toolCalls) {

        // first notify
        eventCallback?.call(this, {
          type: 'tool',
          content: this.getToolPreparationDescription(toolCall.function)
        })

        // first notify
        eventCallback?.call(this, {
          type: 'tool',
          content: this.getToolRunningDescription(toolCall.function)
        })

        // now execute
        const args = JSON.parse(toolCall.args)
        const content = await this.callTool(toolCall.function, args)
        console.log(`[openai] tool call ${toolCall.function} with ${JSON.stringify(args)} => ${JSON.stringify(content).substring(0, 128)}`)

        // send
        this.currentChat.sendMessageStream([
          { functionResponse: {
            name: toolCall.function,
            response: content
          }}
        ])

        // clear
        eventCallback?.call(this, {
          type: 'tool',
          content: null,
        })

      }

      // done
      return null
      
    }

    // text chunk
    return {
      text: chunk.text(),
      done: chunk.candidates[0].finishReason === 'STOP'
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
    //TODO
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse> {
    return null    
  }

}
