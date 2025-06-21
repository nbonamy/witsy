
import { Configuration, ModelType } from '../types/config';

export const baseURL = 'https://fal.ai'

export default class Falai {

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

    if (!this.config.engines.falai.models[type]) {
      this.config.engines.falai.models[type] = []
    }

    try {

      const response = await fetch(`${baseURL}/models?categories=${name}`)
      const html = await response.text()
      const match = /\{\\"models\\":(.*?),\\"filter/.exec(html)
      const json = match[1].replaceAll('\\"', '"').replaceAll('\\"', '"')
      const models = JSON.parse(json)

      this.config.engines.falai.models[type] = models.map((model: any) => ({
        id: model.id,
        name: model.id,
      })).sort((a: any, b: any) => a.id.localeCompare(b.id))

      return

    }

    catch (e) {
      console.error(`Error loading collection ${name} from HTML. Falling back`, e)
    }

    // fallback to hardcoded lists

    try {

      if (name === 'text-to-image') {

        this.config.engines.falai.models.image = [
          'fal-ai/recraft-v3',
          'fal-ai/flux-pro/v1.1-ultra',
          'fal-ai/ideogram/v2',
          'fal-ai/flux-pro/v1.1-ultra-finetuned',
          'fal-ai/minimax-image',
          'fal-ai/aura-flow',
          'fal-ai/flux/dev',
        ].sort().map(name => ({ id: name, name }))

      } else if (name === 'image-to-image') {

        this.config.engines.falai.models.imageEdit = [
        ]

      } else if (name === 'text-to-video') {

        this.config.engines.falai.models.video = [
          'fal-ai/kling-video/v2.1/master/text-to-video',
          'fal-ai/veo3',
          'fal-ai/veo2',
          'fal-ai/minimax/video-01',
          'fal-ai/minimax/video-01-live',
          'fal-ai/minimax/video-01-director',
          'fal-ai/mochi-v1',
          'fal-ai/stepfun-video',
          'fal-ai/hunyuan-video',
        ].map(name => ({ id: name, name }))

      } else if (name === 'video-to-video') {

        this.config.engines.falai.models.videoEdit = [
        ]

      }

    } catch (e) {
      console.error(`Error loading collection ${name}`, e)
      return null
    }
  }

}
