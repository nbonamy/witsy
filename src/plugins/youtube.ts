
import { anyDict } from '../types/index'
import { PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import { YoutubeTranscript } from 'youtube-transcript'
import ytv from 'ytv'

export default class extends Plugin {

  constructor(config: PluginConfig) {
    super(config)
  }

  isEnabled(): boolean {
    return this.config?.enabled
  }

  getName(): string {
    return 'get_youtube_transcript'
  }

  getDescription(): string {
    return 'Returns the transcript of a YouTube video'
  }

  getPreparationDescription(): string {
    return this.getRunningDescription()
  }

  getRunningDescription(): string {
    return 'Downloading transcript…'
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

  async execute(parameters: anyDict): Promise<anyDict> {

    try {
      const info = await ytv.get_info(parameters.url)
      const transcript = await YoutubeTranscript.fetchTranscript(parameters.url)
      return {
        title: info.title,
        channel: info.channel_name,
        content: transcript.map((line: any) => line.text).join(' ')
      }
    } catch (error) {
      console.error(error)
      return { error: error }
    }

  }  

}
