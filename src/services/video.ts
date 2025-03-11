
import { anyDict, MediaCreator, MediaCreationEngine } from '../types/index'
import { store } from '../services/store'
import { saveFileContents } from '../services/download'
import { Model } from 'multi-llm-ts'
import Replicate, { FileOutput } from 'replicate'

export default class VideoCreator implements MediaCreator {

  static getEngines(checkApiKey: boolean): MediaCreationEngine[] {
    const engines = []
    if (!checkApiKey || store.config.engines.replicate.apiKey) {
      engines.push({ id: 'replicate', name: 'Replicate' })
    }
    return engines
  }

  static getModels(engine: string): Model[] {
    if (engine == 'replicate') {
      return [
        'wavespeedai/wan-2.1-t2v-480p',
        'minimax/video-01',
        'minimax/video-01-live',
        'tencent/hunyuan-video',
        'fofr/Itx-video',
        'luma/ray',
        'haiper-ai/haiper-video-2',
        'genmoai/mochi-1'
      ].map(name => ({ id: name, name }))
    } else {
      return []
    }
  }

  getEngines(checkApiKey: boolean): MediaCreationEngine[] {
    return VideoCreator.getEngines(checkApiKey)
  }

  getModels(engine: string): Model[] {
    return VideoCreator.getModels(engine)
  }

  async execute(engine: string, model: string, parameters: anyDict): Promise<any> {
    if (engine === 'replicate') {
      return this.replicate(model, parameters)
    } else {
      throw new Error('Unsupported engine')
    }
  }

  async replicate(model: string, parameters: anyDict): Promise<any> {

    // init
    const client = new Replicate({ auth: store.config.engines.replicate.apiKey }); 

    // call
    console.log(`[replicate] prompting model ${model}`)
    const output: FileOutput[] = await client.run(model as `${string}/${string}`, {
      input: parameters,
    }) as FileOutput[];

    // save the content on disk
    const blob = Array.isArray(output) ? await output[0].blob() : await (output as FileOutput).blob()
    const type = blob.type?.split('/')[1] || 'mp4'
    const b64 = await this.blobToBase64(blob)
    const image = b64.split(',')[1]
    const fileUrl = saveFileContents(type, image)
    //console.log('[image] saved image to', fileUrl)

    // return an object
    return {
      url: fileUrl,
    }

  }
  
  async blobToBase64(blob: Blob): Promise<string>{
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
  }
}
