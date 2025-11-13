
import { PluginExecutionContext, PluginParameter } from 'multi-llm-ts'
import { anyDict } from 'types/index'
import Plugin, { PluginConfig } from './plugin'
// import { YoutubeTranscript } from 'youtube-transcript'
import TranscriptAPI from 'youtube-transcript-api'
import ytv from 'ytv'
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
      const info = await ytv.get_info(parameters.url)

      // const transcript = await YoutubeTranscript.fetchTranscript(parameters.url)

      // const client = new TranscriptClient()
      // await client.ready
      const id = this.extractVideoId(parameters.url)
      const transcripts = await TranscriptAPI.getTranscript(id)
      const transcript = transcripts//.tracks[0].transcript

      return {
        title: info.title || transcripts.title,
        channel: info.channel_name || transcripts.author,
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
