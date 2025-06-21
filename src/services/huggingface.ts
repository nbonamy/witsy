
import { Configuration, ModelType } from '../types/config';

// export const baseURL = 'https://api.replicate.com/v1/'

export default class HuggingFace {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  async loadModels(): Promise<boolean> {
    try {
      await Promise.all([
        this.loadCollection('text-to-image', 'image'),
        this.loadCollection('image-to-image', 'imageEdit'),
        this.loadCollection('text-to-video', 'video'),
        this.loadCollection('video-to-video', 'videoEdit')
      ])
      return true
    } catch (e) {
      console.error('Error loading SDWebUI Models', e)
      return false
    }
  }

  async loadCollection(name: string, type: ModelType): Promise<boolean> {

    try {

      if (!this.config.engines.huggingface.models[type]) {
        this.config.engines.huggingface.models[type] = []
      }

      if (name === 'text-to-image') {

        this.config.engines.huggingface.models.image = [
        'black-forest-labs/FLUX.1-schnell',
        'black-forest-labs/FLUX.1-dev',
        'dreamlike-art/dreamlike-photoreal-2.0',
        'prompthero/openjourney',
        'stabilityai/stable-diffusion-3.5-large-turbo',
        ].sort().map(name => ({ id: name, name }))

      } else if (name === 'image-to-image') {

        this.config.engines.huggingface.models.imageEdit = [
        ]

      } else if (name === 'text-to-video') {

        this.config.engines.huggingface.models.video = [
        ]

      } else if (name === 'video-to-video') {

        this.config.engines.huggingface.models.videoEdit = [
        ]

      }

    } catch (e) {
      console.error(`Error loading collection ${name}`, e)
      return null
    }
  }

}
