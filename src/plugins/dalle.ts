
import { anyDict } from 'types/index.d'
import { PluginConfig, PluginParameter } from 'types/plugin.d'
import { store } from '../services/store'
import { saveFileContents } from '../services/download'
import Plugin from './plugin'
import OpenAI from 'openai'

export default class extends Plugin {

  constructor(config: PluginConfig) {
    super(config)
  }

  isEnabled(): boolean {
    return store.config?.engines.openai.apiKey != null
  }

  getName(): string {
    return 'dalle_image_generation'
  }

  getDescription(): string {
    return 'Generate an image based on a prompt. Returns the path of the image saved on disk and a description of the image.'
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }
      
  getRunningDescription(): string {
    return 'Painting pixels…'
  }

  getParameters(): PluginParameter[] {

    const parameters: PluginParameter[] = [
      {
        name: 'prompt',
        type: 'string',
        description: 'The description of the image',
        required: true
      }
    ]

    // rest depends on model
    if (store.config.engines.openai.model.image === 'dall-e-2') {

      parameters.push({
        name: 'size',
        type: 'string',
        enum: [ '256x256', '512x512', '1024x1024' ],
        description: 'The size of the image',
        required: false
      })

    } else if (store.config.engines.openai.model.image === 'dall-e-3') {

      parameters.push({
        name: 'quality',
        type: 'string',
        enum: [ 'standard', 'hd' ],
        description: 'The quality of the image',
        required: false
      })

      parameters.push({
        name: 'size',
        type: 'string',
        enum: [ '1024x1024', '1792x1024', '1024x1792' ],
        description: 'The size of the image',
        required: false
      })

      parameters.push({
        name: 'style',
        type: 'string',
        enum: ['vivid', 'natural'],
        description: 'The style of the image',
        required: false
      })

    }

    // done
    return parameters
  
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
      quality: parameters?.quality,
      n: parameters?.n || 1,
    })

    // save the content on disk
    const fileUrl = saveFileContents('png', response.data[0].b64_json)

    // return an object
    return {
      path: fileUrl,
      description: parameters?.prompt
    }

  }  

}
