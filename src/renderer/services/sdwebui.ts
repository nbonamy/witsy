
import { Configuration } from 'types/config'
import { Model } from 'multi-llm-ts'
import { ModelLoader } from './model_loader'

export const baseURL = 'http://127.0.0.1:7860'

export default class SDWebUI implements ModelLoader {

  config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  get baseUrl(): string {
    return this.config.engines.sdwebui.baseURL || baseURL
  }

  async loadModels(): Promise<boolean> {
    try {
      const models = await this.getModels()
      this.config.engines.sdwebui.models.image = models
      return true
    } catch (e) {
      console.error('Error loading SDWebUI Models', e)
      return false
    }
  }

  async getModels(): Promise<Model[]> {

    const response = await fetch(`${this.baseUrl}/sdapi/v1/sd-models`)
    const json = await response.json()
    return json.map((model: any) => ({
      id: model.title,
      name: model.model_name,
      meta: model
    }))

  }

  async generateImage(model: string, prompt: string, parameters: any): Promise<any> {

    try {
    
      const response = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          prompt: prompt,
          override_settings: {
            sd_model_checkpoint: model,
          },
          override_settings_restore_afterwards: true,
          ...parameters
        })
      })

      const json = await response.json()
      return json

    } catch (e) {
      console.error(e)
      throw new Error('SDWebUI: Failed to generate image')
    }

  } 

}
