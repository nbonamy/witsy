
import OpenAI from 'openai'

export default class {

  constructor(config) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      dangerouslyAllowBrowser: true
    })
  }

  async synthetize(text, opts) {
    
    // call
    const response = await this.client.audio.speech.create({
      model: this.config.openai.tts.model || 'tts-1',
      voice: this.config.openai.tts.voice || 'alloy',
      input: text
    });

    // return an object
    return {
      type: 'audio',
      content: response
    }
  }

}