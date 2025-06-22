
import { anyDict } from '../types/index'
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import Plugin, { PluginConfig } from './plugin'
// import { YoutubeTranscript } from 'youtube-transcript'
import TranscriptClient from 'youtube-transcript-api'
import { t } from '../services/i18n'
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
      const info = await ytv.get_info(parameters.url)

      // const transcript = await YoutubeTranscript.fetchTranscript(parameters.url)

      // extract id from "https://www.youtube.com/watch?v=TE1EMFcFuJ4&t=468"

      const client = new TranscriptClient()
      await client.ready
      const id = this.extractVideoId(parameters.url)
      const transcripts = await client.getTranscript(id)
      const transcript = transcripts.tracks[0].transcript

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

  private extractVideoId(videoId: string) {
    if (videoId.length === 11)  return videoId
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
    const matchId = videoId.match(regex)
    if (matchId && matchId.length) {
      return matchId[1]
    }
    return null
  }
}
