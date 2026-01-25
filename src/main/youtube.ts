
import { YoutubeTranscript } from 'youtube-transcript-scraper'
import ytv from 'ytv'

export interface YoutubeVideoInfo {
  title: string
  channel: string
  transcript: string
}

export const getTranscript = async (url: string): Promise<YoutubeVideoInfo> => {
  try {
    const [transcriptItems, info] = await Promise.all([
      YoutubeTranscript.fetchTranscript(url),
      ytv.get_info(url),
    ])
    return {
      title: info.title,
      channel: info.channel_name,
      transcript: transcriptItems.map((item) => item.text).join(' '),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to fetch YouTube transcript: ${message}`)
  }
}
