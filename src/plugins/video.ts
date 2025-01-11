
import { store } from '../services/store'
import { saveFileContents } from '../services/download'
import { PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import Replicate, { FileOutput } from 'replicate'

export default class extends Plugin {

  constructor(config: PluginConfig) {
    super(config)
  }

  isEnabled(): boolean {
    return this.config?.enabled && (
      (this.config.engine == 'replicate' && store.config?.engines.replicate.apiKey?.trim().length > 0)
    )
  }

  getName(): string {
    return 'video_generation'
  }

  getDescription(): string {
    return this.config.description
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }
      
  getRunningDescription(): string {
    return 'Animating frames…'
  }

  getParameters(): PluginParameter[] {

    // every one has this
    const parameters: PluginParameter[] = [
      {
        name: 'prompt',
        type: 'string',
        description: 'The description of the video',
        required: true
      }
    ]

    // done
    return parameters
  
  }

  async execute(parameters: any): Promise<any> {

    // init
    const client = new Replicate({ auth: store.config.engines.replicate.apiKey }); 

    // call
    const model = store.config.engines.replicate.model.video
    console.log(`[replicate] prompting model ${model}`)
    const output: FileOutput[] = await client.run(model as `${string}/${string}`, {
      input: {
        prompt: parameters?.prompt,
      }
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
