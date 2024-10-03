
import { Configuration } from 'types/config.d'
import getSTTEngine, { STTEngine, TranscribeResponse } from '../services/stt'
import { store } from '../services/store'

class Transcriber {

  config: Configuration
  engine: STTEngine

  constructor(config: Configuration) {
    this.config = config
  }

  async initialize() {
    this.engine = getSTTEngine(this.config)
    await this.engine.initialize()
  }

  isReady(): boolean {
    return this.engine && this.engine.isReady()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transcribe(audioChunks: any[], opts?: object): Promise<TranscribeResponse> {

    // get the chunks as audio/webm
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })

    // now transcribe
    return this.engine.transcribe(audioBlob)

  }

}

export default function useTranscriber() {
  return new Transcriber(store.config)
}
