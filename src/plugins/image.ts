
import { anyDict } from '../types/index'
import { store } from '../services/store'
import { i18nInstructions } from '../services/i18n'
import { PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import ImageCreator from '../services/image'

export default class extends Plugin {

  creator: ImageCreator
  
  constructor(config: PluginConfig) {
    super(config)
    this.creator = new ImageCreator()
  }

  isEnabled(): boolean {
    return this.config?.enabled && (
      (this.config.engine == 'openai' && store.config?.engines.openai.apiKey?.trim().length > 0) ||
      (this.config.engine == 'google' && store.config?.engines.google.apiKey?.trim().length > 0) ||
      (this.config.engine == 'xai' && store.config?.engines.xai.apiKey?.trim().length > 0) ||
      (this.config.engine == 'replicate' && store.config?.engines.replicate.apiKey?.trim().length > 0) ||
      (this.config.engine == 'falai' && store.config?.engines.falai.apiKey?.trim().length > 0) ||
      (this.config.engine == 'huggingface' && store.config?.engines.huggingface.apiKey?.trim().length > 0) ||
      (this.config.engine == 'sdwebui')
    )
  }

  getName(): string {
    return 'image_generation'
  }

  getDescription(): string {
    return i18nInstructions({ plugins: { image: this.config } }, 'plugins.image.description')
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }
      
  getRunningDescription(): string {
    return `#${this.config.engine}# Painting pixels…`
  }

  getParameters(): PluginParameter[] {

    // every one has this
    const parameters: PluginParameter[] = [
      {
        name: 'prompt',
        type: 'string',
        description: 'The description of the image',
        required: true
      }
    ]

    // openai parameters
    if (this.config.engine == 'openai') {

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

    }

    // huggingface parameters
    if (this.config.engine == 'huggingface') {

      // parameters.push({
      //   name: 'negative_prompt',
      //   type: 'string',
      //   description: 'Stuff to avoid in the generated image',
      //   required: false
      // })

      // parameters.push({
      //   name: 'width',
      //   type: 'number',
      //   description: 'The width of the image',
      //   required: false
      // })

      // parameters.push({
      //   name: 'height',
      //   type: 'number',
      //   description: 'The height of the image',
      //   required: false
      // })

    }

    // done
    return parameters
  
  }

  execute(parameters: anyDict): Promise<any> {
    return this.creator.execute(this.config.engine, store.config.engines[this.config.engine].model.image, parameters)
  }

}
