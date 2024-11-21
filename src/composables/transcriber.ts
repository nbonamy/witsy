
import { type Configuration } from '@types/config.d'
import getSTTEngine, { type STTEngine, type TranscribeResponse } from '../voice/stt'

class Transcriber {

  config: Configuration
  engine: STTEngine|null

  constructor(config: Configuration) {
    this.config = config
    this.engine = null
  }

  async initialize() {
    this.engine = getSTTEngine(this.config)
    await this.engine.initialize()
  }

  isReady(): boolean {
    return this.engine != null && this.engine.isReady()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transcribe(audioChunks: any[], opts?: object): Promise<TranscribeResponse> {

    // check
    if (!this.engine) {
      throw new Error('Transcriber not initialized')
    }

    // get the chunks as audio/webm
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })

    // now transcribe
    return this.engine.transcribe(audioBlob)

  }

}

export default function useTranscriber(config: Configuration) {
  return new Transcriber(config)
}
