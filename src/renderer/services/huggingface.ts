
import { ChatModel } from 'multi-llm-ts'
import { Configuration, ModelType } from 'types/config'
import { listModels, PipelineType } from '@huggingface/hub'
import { ModelLoader } from './model_loader'

export default class HuggingFace implements ModelLoader {

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

  async loadCollection(task: PipelineType|'video-to-video', type: ModelType): Promise<boolean> {

    // for typescript linting
    if (type === 'chat') {
      return false
    }

    try {

      // reset models
      this.config.engines.huggingface.models[type] = []

      // no task for video-to-video
      if (task === 'video-to-video') {
        return true
      }

      // list and push
      const models = await listModels({
        accessToken: this.config.engines.huggingface.apiKey,
        search: { task: task },
        limit: 50,
      })
      for await (const model of models) {
        this.config.engines.huggingface.models[type].push({
          id: model.name,
          name: model.name,
        } as ChatModel)
      }

      // fallback
      if (task === 'text-to-image' && this.config.engines.huggingface.models.image.length === 0) {
        this.config.engines.huggingface.models.image = [
          'black-forest-labs/FLUX.1-schnell',
          'black-forest-labs/FLUX.1-dev',
          'dreamlike-art/dreamlike-photoreal-2.0',
          'prompthero/openjourney',
          'stabilityai/stable-diffusion-3.5-large-turbo',
        ].sort().map(name => ({ id: name, name }))
      }

    } catch (e) {
      console.error(`Error loading collection ${name}`, e)
      return null
    }
  }

}
