
import { Configuration, ModelType } from 'types/config'
import { ModelLoader } from './model_loader'

export const baseURL = 'https://api.replicate.com/v1/'

export default class Replicate implements ModelLoader {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  async loadModels(): Promise<boolean> {
    try {
      await Promise.all([
        this.loadCollection('text-to-image', 'image'),
        this.loadCollection('image-editing', 'imageEdit'),
        this.loadCollection('text-to-video', 'video'),
        this.loadCollection('ai-enhance-videos', 'videoEdit')
      ])
      return true
    } catch (e) {
      console.error('Error loading SDWebUI Models', e)
      return false
    }
  }

  async loadCollection(name: string, type: ModelType): Promise<boolean> {

    try {
    
      if (!this.config.engines.replicate.models[type]) {
        this.config.engines.replicate.models[type] = []
      }

      const response = await fetch(`${baseURL}/collections/${name}`, {
        headers: { 'Authorization': `Bearer ${this.config.engines.replicate.apiKey}` }
      })
      if (!response.ok) {
        throw new Error(`Failed to load collection: ${response.statusText}`)
      }

      const collection = await response.json()
      this.config.engines.replicate.models[type] = collection.models.map((model: any) => ({
        id: `${model.owner}/${model.name}`,
        name: `${model.owner}/${model.name}`,
        ...(model.latest_version?.id ? { meta: {
          version: model.latest_version.id
        }} : {}),
      })).filter((model: any, index: number, array: any[]) => 
        array.findIndex((m: any) => m.id === model.id) === index
      ).sort((a: any, b: any) => a.name.localeCompare(b.name))

    } catch (e) {
      console.error(`Error loading collection ${name}`, e)
      return null
    }
  }

}
