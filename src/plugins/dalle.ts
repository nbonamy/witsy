
import { anyDict } from '../types/index.d'
import { PluginConfig, PluginParameter } from '../types/plugin.d'
import { store } from '../services/store'
import { saveFileContents } from '../services/download'
import Plugin from './plugin'
import OpenAI from 'openai'

export default class extends Plugin {

  constructor(config: PluginConfig) {
    super(config)
  }

  isEnabled(): boolean {
    return store.config.engines.openai.apiKey != null
  }

  getName(): string {
    return 'dalle_image_generation'
  }

  getDescription(): string {
    return 'Generate an image based on a prompt. Returns the path of the image saved on disk.'
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }
      
  getRunningDescription(): string {
    return 'Painting pixels…'
  }

  getParameters(): PluginParameter[] {
    return [
      {
        name: 'prompt',
        type: 'string',
        description: 'The description of the image',
        required: true
      },
      // {
      //   name: 'size',
      //   type: 'string',
      //   description: 'The size of the image',
      //   required: false
      // },
      // {
      //   name: 'style',
      //   type: 'string',
      //   description: 'The style of the image',
      //   required: false
      // },
      // {
      //   name: 'n',
      //   type: 'number',
      //   description: 'Number of images to generate',
      //   required: false
      // },
    ]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(parameters: anyDict): Promise<anyDict> {

    // init
    const client = new OpenAI({
      apiKey: store.config.engines.openai.apiKey,
      dangerouslyAllowBrowser: true
    })

    // call
    const model = store.config.engines.openai.model.image
    console.log(`[openai] prompting model ${model}`)
    const response = await client.images.generate({
      model: model,
      prompt: parameters?.prompt,
      response_format: 'b64_json',
      size: parameters?.size,
      style: parameters?.style,
      n: parameters?.n || 1,
    })

    // save the content on disk
    const filename = saveFileContents('png', response.data[0].b64_json)


    // return an object
    return {
      path: `file://${filename}`
    }

  }  

}
