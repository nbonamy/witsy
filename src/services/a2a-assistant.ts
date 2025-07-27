
import { Configuration } from '../types/config'
import Attachment from '../models/attachment'
import Message from '../models/message'
import Chat from '../models/chat'
import A2AClient from './a2a-client'
import Generator, { LlmChunkCallback } from './generator'
import { LlmChunkContent } from 'multi-llm-ts'
import { GenerationCallback } from './assistant'

export default class A2AAssistant {

  chat: Chat
  config: Configuration
  client: A2AClient

  constructor(config: Configuration, baseUrl: string) {
    this.config = config
    this.chat = new Chat()
    this.client = new A2AClient(baseUrl)
  }

  setChat(chat: Chat) {
    this.chat = chat
  }

  initChat(): Chat {
    this.chat = new Chat()
    return this.chat
  }

  async prompt(prompt: string, llmCallback: LlmChunkCallback, generationCallback?: GenerationCallback): Promise<void> {

    // we need a chat
    if (this.chat === null) {
      throw new Error('Chat is not initialized')
    }

    // create system message if not exists
    if (this.chat.messages.length === 0) {
      this.chat.addMessage(new Message('system', ''))
    }

    // update system message with latest instructions
    const generator = new Generator(this.config)
    this.chat.messages[0].content = generator.getSystemInstructions(this.chat.instructions)

    // add user message
    const userMessage = new Message('user', prompt)
    this.chat.addMessage(userMessage)

    // add assistant message
    const assistantMessage = new Message('assistant')
    this.chat.addMessage(assistantMessage)
    llmCallback(null)

    // callback
    generationCallback('before_generation')

    // now process chunks
    for await (const chunk of this.client.execute(prompt)) {

      //console.log('A2A chunk:', chunk)
      
      // get the current assistant message (last in the array) to ensure reactivity
      const assistantMessage = this.chat.messages[this.chat.messages.length - 1]
      
      if (chunk.type === 'content') {
        
        assistantMessage.appendText(chunk)
        llmCallback(chunk)
      
      } else if (chunk.type === 'status') {

        // for now emit text status
        const textChunk: LlmChunkContent = {
          type: 'content',
          text: `${chunk.status}\n\n`,
          done: false,
        }
        assistantMessage.appendText(textChunk)
        llmCallback(textChunk)

      } else if (chunk.type === 'artifact') {

        // debug: emit test
        const textChunk: LlmChunkContent = {
          type: 'content',
          text: `artifact \`${chunk.name}\`:\n\n\`\`\`${chunk.content}\`\`\`\n\n`,
          done: false,
        }
        assistantMessage.appendText(textChunk)
        llmCallback(textChunk)

        // attach
        assistantMessage.attach(new Attachment(chunk.content, 'text/plain', chunk.name))

      }

    }

  }

}
