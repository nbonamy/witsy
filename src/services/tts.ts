
import { Configuration } from '../index.d'
import OpenAI from 'openai'

export default class {

  config: Configuration
  client: OpenAI

  constructor(config: Configuration) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.engines.openai.apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  async synthetize(text: string, opts: { model?: string, voice?: string}) {
    
    // call
    const response = await this.client.audio.speech.create({
      model: opts?.model || this.config.engines.openai.tts.model || 'tts-1',
      voice: opts?.voice || this.config.engines.openai.tts.voice || 'alloy',
      input: text
    });

    // return an object
    return {
      type: 'audio',
      content: response
    }
  }

}