
import { anyDict } from 'types/index.d'
import { PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
import { YoutubeTranscript } from 'youtube-transcript'

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
      const transcript = await YoutubeTranscript.fetchTranscript(parameters.url)
      return { content: transcript.map((line: any) => line.text).join(' ') }
    } catch (error) {
      return error
    }

  }  

}
