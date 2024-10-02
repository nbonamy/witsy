
import { Configuration } from 'types/config.d'
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

  async transcribe(audioBlob: Blob, opts?: { } ) {

    // call
    const response = await this.client.audio.transcriptions.create({
      file: new File([audioBlob], 'audio.webm', { type: audioBlob.type }),
      model: 'whisper-1'
    });

    // return
    return response
  }

}