
import { LlmEngine, LlmCompletionOpts, LlmChunk } from 'multi-llm-ts'
import { Configuration } from '../types/config'
import { DocRepoQueryResponseItem } from '../types/rag'
import { countryCodeToName } from './i18n'
import Message from '../models/message'

export interface GenerationOpts extends LlmCompletionOpts {
  model: string
  docrepo?: string
  sources?: boolean
}

export default class Generator {

  config: Configuration
  stopGeneration: boolean
  stream: AsyncIterable<LlmChunk>|null
  llm: LlmEngine|null

  static addDateAndTimeToSystemInstr = true

  constructor(config: Configuration) {
    this.config = config
    this.stream = null
    this.stopGeneration = false
    this.llm = null
  }

  async generate(llm: LlmEngine, messages: Message[], opts: GenerationOpts, callback?: (chunk: LlmChunk) => void): Promise<boolean> {

    // return code
    let rc = true

    // get messages
    const response = messages[messages.length - 1]
    const conversation = this.getConversation(messages)

    try {

      // rag?
      let sources: DocRepoQueryResponseItem[] = [];
      if (opts.docrepo) {
        const userMessage = conversation[conversation.length - 1];
        sources = await window.api.docrepo.query(opts.docrepo, userMessage.content);
        //console.log('Sources', JSON.stringify(sources, null, 2));
        if (sources.length > 0) {
          const context = sources.map((source) => source.content).join('\n\n');
          const prompt = this.config.instructions.docquery.replace('{context}', context).replace('{query}', userMessage.content);
          conversation[conversation.length - 1] = new Message('user', prompt);
        }
      }

      // now stream
      this.stopGeneration = false
      this.stream = await llm.generate(opts.model, conversation, {
        models: this.config.engines[llm.getName()]?.models?.chat,
        autoSwitchVision: this.config.llm.autoVisionSwitch,
        usage: true,
        ...opts
      })
      for await (const msg of this.stream) {
        if (this.stopGeneration) {
          break
        }
        if (msg.type === 'usage') {
          response.usage = msg.usage
        } else if (msg.type === 'tool') {
          response.setToolCall(msg)
        } else if (msg.type === 'content') {
          if (msg && sources && sources.length > 0) {
            msg.done = false
          }
          response.appendText(msg)
          callback?.call(null, msg)
        }
      }

      // append sources
      if (opts.sources && sources && sources.length > 0) {

        // reduce to unique sources based on metadata.id
        const uniqueSourcesMap = new Map();
        sources.forEach(source => {
          uniqueSourcesMap.set(source.metadata.uuid, source);
        })
        sources = Array.from(uniqueSourcesMap.values());

        // now add them
        let sourcesText = '\n\nSources:\n\n'
        sourcesText += sources.map((source) => `- [${source.metadata.title}](${source.metadata.url})`).join('\n')
        response.appendText({ type: 'content', text: sourcesText, done: true })
        callback?.call(null, { type: 'content', text: sourcesText, done: true })
      }

    } catch (error) {
      console.error('Error while generating text', error)
      if (error.name !== 'AbortError') {
        const message = error.message.toLowerCase()
        if (error.status === 401 || message.includes('401') || message.includes('apikey')) {
          response.setText('You need to enter your API key in the Models tab of <a href="#settings_models">Settings</a> in order to chat.')
          rc = false
        } else if ((error.status === 400 || error.status === 402) && (message.includes('credit') || message.includes('balance'))) {
          response.setText('Sorry, it seems you have run out of credits. Check the balance of your LLM provider account.')
          rc = false
        } else if (error.status === 400 && (message.includes('context length') || message.includes('too long'))) {
          if (message.includes('function.description')) {
            response.setText('Sorry, it seems that one of the plugins description is too long. If you tweaked them in Settings | Advanced, please try again.')
          } else {
            response.setText('Sorry, it seems this message exceeds this model context length. Try to shorten your prompt or try another model.')
          }
          rc = false
        } else if ((error.status === 400 || error.status === 404) && (message.includes('function call') || message.includes('tools') || message.includes('tool use'))) {
          if (llm.plugins.length > 0) {
            console.log('Model does not support function calling: removing tool and retrying')
            llm.clearPlugins()
            return this.generate(llm, messages, opts, callback)
          }
        } else if (error.status === 429 && (message.includes('resource') || message.includes('quota') || message.includes('too many'))) {
          response.setText('Sorry, it seems you have reached the rate limit of your LLM provider account. Try again later.')
          rc = false
        } else if (response.content === '') {
          response.setText('Sorry, I could not generate text for that prompt.')
          rc = false
        } else {
          response.appendText({ type: 'content', text: '\n\nSorry, I am not able to continue here.', done: true })
          rc = false
        }
      } else {
        callback?.call(null, { type: 'content', text: null, done: true })
      }
    }

    // cleanup
    this.stream = null
    //callback?.call(null, null)

    // done
    return rc

  }

  async stop() {
    if (this.stream) {
      await this.llm?.stop(this.stream)
      this.stopGeneration = true
    }
  }

  getConversation(messages: Message[]): Message[] {
    const conversationLength = this.config.llm.conversationLength
    const chatMessages = messages.filter((msg) => msg.role !== 'system')
    const conversation = [
      new Message('system', this.patchSystemInstructions(messages[0].content)),
      ...chatMessages.slice(-conversationLength * 2, -1)
    ]
    for (const message of conversation) {
      if (message.attachment && !message.attachment.content) {
        message.attachment.loadContents()
      }
    }
    return conversation
  }

  getSystemInstructions(instructions?: string) {

    // default
    let instr = instructions || this.config.instructions.default

    // language. asking the LLM to talk in the user language confuses them more than often!
    if (this.config.general.language) instr += ' Always answer in ' + countryCodeToName(this.config.general.language) + '.'
    //else instr += ' Always reply in the user language unless expicitely asked to do otherwise.'

    // add date and time
    if (Generator.addDateAndTimeToSystemInstr) {
      instr += ' Current date and time is ' + new Date().toLocaleString() + '.'
    }

    // done
    return instr
  }

  patchSystemInstructions(instructions: string) {
    return instructions.replace(/Current date and time is [^.]+/, 'Current date and time is ' + new Date().toLocaleString())
  }

}
