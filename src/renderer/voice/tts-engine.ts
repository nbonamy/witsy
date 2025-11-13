
import { Configuration } from 'types/config'
import * as nodeStream from 'stream'

export type SynthesisStream = nodeStream.Readable

export type SynthesisContent = Response|ReadableStream|string

export type SynthesisResponse = {
  type: 'audio'
  mimeType?: string
  content: SynthesisContent
}

export abstract class TTSEngine {
  
  config: Configuration
  
  constructor(config: Configuration) {
    this.config = config
  }
  
  abstract synthetize(text: string, opts?: object): Promise<SynthesisResponse>

  async readWavResponse (audioResponse: Response): Promise<SynthesisResponse> {
    const base64URI = await this.toBase64URI(audioResponse);
    return {
      type: 'audio',
      mimeType: 'audio/wav',
      content: base64URI
    }
  }

  async toBase64URI(response: Response): Promise<string> {
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

}
