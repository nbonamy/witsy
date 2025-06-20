
import { Configuration } from '../types/config';

export const baseURL = 'https://api.replicate.com/v1/'

export default class Replicate {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  async loadModels(): Promise<boolean> {
    try {
      await this.loadCollection('text-to-image', 'text-to-image')
      await this.loadCollection('image-to-image', 'image-editing')
      await this.loadCollection('text-to-video', 'text-to-video')
      await this.loadCollection('video-to-video', 'ai-enhance-videos')
      return true
    } catch (e) {
      console.error('Error loading SDWebUI Models', e)
      return false
    }
  }

  async loadCollection(name: string, slug: string): Promise<boolean> {

    try {
    
      const response = await fetch(`${baseURL}/collections/${slug}`, {
        headers: { 'Authorization': `Bearer ${this.config.engines.replicate.apiKey}` }
      })
      if (!response.ok) {
        throw new Error(`Failed to load collection: ${response.statusText}`)
      }

      const collection = await response.json()
      if (!this.config.engines.replicate.models.other) {
        this.config.engines.replicate.models.other = {}
      }
      
      this.config.engines.replicate.models.other[name] = collection.models.map((model: any) => ({
        id: `${model.owner}/${model.name}`,
        name: `${model.owner}/${model.name}`,
      })).filter((model: any, index: number, array: any[]) => 
        array.findIndex((m: any) => m.id === model.id) === index
      ).sort((a: any, b: any) => a.name.localeCompare(b.name))

    } catch (e) {
      console.error(`Error loading collection ${slug}`, e)
      return null
    }
  }

}
