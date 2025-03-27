
/*import { Configuration } from '../types/config'
import { SynthesisResponse, TTSEngine } from './tts-engine'
import Replicate, { FileOutput, Prediction } from 'replicate'

export default class TTSReplicate extends TTSEngine {

  config: Configuration
  client: Replicate

  constructor(config: Configuration) {
    this.config = config
    this.client = new Replicate({ auth: config.engines.replicate.apiKey })
  }

  async synthetize(text: string, opts?: { model?: string, voice?: string}): Promise<SynthesisResponse> {
    
    return new Promise((resolve, reject) => {
      
      const synthesizeAsync = async () => {
        // call
        const model = (opts?.model || this.config.tts.model) as `${string}/${string}`
        await this.client.run(model, { input: {
          voice: opts?.voice || this.config.tts.voice,
          format: 'mp3',
          speed: 1.1,
          text: text
        }}, async (prediction: Prediction) => {
          
          if (prediction.urls.stream) {

            const response = await fetch(prediction.urls.stream)
            resolve({
              type: 'audio',
              content: response
            })

          } else if (['failed', 'cancelled'].includes(prediction.status)) {
            reject(prediction.error)
          }

        }) as FileOutput[];
      };

      synthesizeAsync().catch(reject);
    })
  }

  async blobToBase64(blob: Blob): Promise<string>{
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
  }
}*/
