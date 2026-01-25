
import { vi, expect, test, beforeEach } from 'vitest'
import { getTranscript } from '@main/youtube'

vi.mock('youtube-transcript-scraper', () => ({
  YoutubeTranscript: {
    fetchTranscript: vi.fn()
  }
}))

vi.mock('ytv', () => ({
  default: {
    get_info: vi.fn()
  }
}))

import { YoutubeTranscript } from 'youtube-transcript-scraper'
import ytv from 'ytv'

beforeEach(() => {
  vi.clearAllMocks()
})

test('getTranscript returns video info with joined transcript', async () => {
  const mockTranscript = [
    { text: 'Hello', start: 0, duration: 1.5 },
    { text: 'World', start: 1.5, duration: 2 },
  ]

  const mockInfo = {
    title: 'Test Video Title',
    channel_name: 'Test Channel',
  }

  vi.mocked(YoutubeTranscript.fetchTranscript).mockResolvedValue(mockTranscript)
  vi.mocked(ytv.get_info).mockResolvedValue(mockInfo)

  const result = await getTranscript('https://www.youtube.com/watch?v=abc123')

  expect(YoutubeTranscript.fetchTranscript).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc123')
  expect(ytv.get_info).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc123')

  expect(result).toEqual({
    title: 'Test Video Title',
    channel: 'Test Channel',
    transcript: 'Hello World',
  })
})

test('getTranscript handles video ID directly', async () => {
  const mockTranscript = [{ text: 'Test', start: 0, duration: 1 }]
  const mockInfo = { title: 'Video', channel_name: 'Channel' }

  vi.mocked(YoutubeTranscript.fetchTranscript).mockResolvedValue(mockTranscript)
  vi.mocked(ytv.get_info).mockResolvedValue(mockInfo)

  const result = await getTranscript('abc123xyz99')

  expect(YoutubeTranscript.fetchTranscript).toHaveBeenCalledWith('abc123xyz99')
  expect(ytv.get_info).toHaveBeenCalledWith('abc123xyz99')
  expect(result.title).toBe('Video')
  expect(result.transcript).toBe('Test')
})

test('getTranscript fetches transcript and info in parallel', async () => {
  const mockTranscript = [{ text: 'Test', start: 0, duration: 1 }]
  const mockInfo = { title: 'Video', channel_name: 'Channel' }

  let transcriptResolved = false
  let infoResolved = false

  vi.mocked(YoutubeTranscript.fetchTranscript).mockImplementation(async () => {
    transcriptResolved = true
    return mockTranscript
  })

  vi.mocked(ytv.get_info).mockImplementation(async () => {
    infoResolved = true
    return mockInfo
  })

  await getTranscript('test')

  expect(transcriptResolved).toBe(true)
  expect(infoResolved).toBe(true)
})

test('getTranscript wraps transcript fetch error', async () => {
  vi.mocked(YoutubeTranscript.fetchTranscript).mockRejectedValue(new Error('Transcript not available'))
  vi.mocked(ytv.get_info).mockResolvedValue({ title: 'Video', channel_name: 'Channel' })

  await expect(getTranscript('invalid')).rejects.toThrow('Failed to fetch YouTube transcript: Transcript not available')
})

test('getTranscript wraps video info fetch error', async () => {
  vi.mocked(YoutubeTranscript.fetchTranscript).mockResolvedValue([])
  vi.mocked(ytv.get_info).mockRejectedValue(new Error('Video not found'))

  await expect(getTranscript('invalid')).rejects.toThrow('Failed to fetch YouTube transcript: Video not found')
})

test('getTranscript handles non-Error throws', async () => {
  vi.mocked(YoutubeTranscript.fetchTranscript).mockRejectedValue('string error')
  vi.mocked(ytv.get_info).mockResolvedValue({ title: 'Video', channel_name: 'Channel' })

  await expect(getTranscript('invalid')).rejects.toThrow('Failed to fetch YouTube transcript: Unknown error')
})
