
import { anyDict } from '../types/index'
import { store } from '../services/store'
import { i18nInstructions, t } from '../services/i18n'
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import VideoCreator from '../services/video'

export default class extends Plugin {

  creator: VideoCreator

  constructor(config: PluginConfig) {
    super(config)
    this.creator = new VideoCreator()
  }

  isEnabled(): boolean {
    return this.config?.enabled && (
      (this.config.engine == 'replicate' && store.config?.engines.replicate.apiKey?.trim().length > 0) ||
      (this.config.engine == 'falai' && store.config?.engines.falai.apiKey?.trim().length > 0)
    )
  }

  getName(): string {
    return 'video_generation'
  }

  getDescription(): string {
    return i18nInstructions({ plugins: { video: this.config } }, 'plugins.video.description')
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }
      
  getRunningDescription(): string {
    return t('plugins.video.running')
  }

  getCompletedDescription(tool: string, args: any, results: any): string | undefined {
    if (results.error) {
      return t('plugins.video.error')
    } else {
      return t('plugins.video.completed', { engine: this.config.engine, model: this.config.model, prompt: args.prompt })
    }
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

  execute(context: PluginExecutionContext, parameters: anyDict): Promise<any> {
    return this.creator.execute(this.config.engine, this.config.model, parameters)
  }

}
