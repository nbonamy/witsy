
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import { anyDict } from 'types/index'
import Plugin, { PluginConfig } from './plugin'
import { t } from '../i18n'

export const kYoutubePluginName = 'get_youtube_transcript'

export default class extends Plugin {

  constructor(config: PluginConfig, workspaceId: string) {
    super(config, workspaceId)
  }

  isEnabled(): boolean {
    return this.config?.enabled
  }

  getName(): string {
    return kYoutubePluginName
  }

  getDescription(): string {
    return 'Returns the transcript of a YouTube video'
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }

  getRunningDescription(): string {
    return t('plugins.youtube.running')
  }

  getCompletedDescription(tool: string, args: any, results: any): string | undefined {
    if (results.error || !results.content) {
      return t('plugins.youtube.error')
    } else {
      return t('plugins.youtube.completed', { title: results.title || 'video' })
    }
  }

  getParameters(): PluginParameter[] {
    return [
      {
        name: 'url',
        type: 'string',
        description: 'The URL of the YouTube video to get the transcript of',
        required: true
      }
    ]
  }

  async execute(context: PluginExecutionContext, parameters: anyDict): Promise<anyDict> {

    try {
      const result = await window.api.youtube.getTranscript(parameters.url)
      return {
        title: result.title,
        channel: result.channel,
        content: result.transcript
      }
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { error: message }
    }

  }
}
