
import OpenAI from 'openai'
import { Configuration } from 'src';

export default class {

  config: Configuration
  client: OpenAI

  constructor(config: Configuration) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  async synthetize(text: string, opts: { model?: string, voice?: string}) {
    
    // call
    const response = await this.client.audio.speech.create({
      model: opts.model || this.config.openai.tts.model || 'tts-1',
      voice: opts.voice || this.config.openai.tts.voice || 'alloy',
      input: text
    });

    // return an object
    return {
      type: 'audio',
      content: response
    }
  }

}