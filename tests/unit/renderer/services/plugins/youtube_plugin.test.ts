
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock } from '@tests/mocks/window'
import YoutubePlugin from '@services/plugins/youtube'

beforeAll(() => {
  useWindowMock()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Plugin name is correct', () => {
  const plugin = new YoutubePlugin({ enabled: true }, 'workspace1')
  expect(plugin.getName()).toBe('get_youtube_transcript')
})

test('Plugin description is correct', () => {
  const plugin = new YoutubePlugin({ enabled: true }, 'workspace1')
  expect(plugin.getDescription()).toBe('Returns the transcript of a YouTube video')
})

test('isEnabled returns config value', () => {
  const enabledPlugin = new YoutubePlugin({ enabled: true }, 'workspace1')
  expect(enabledPlugin.isEnabled()).toBe(true)

  const disabledPlugin = new YoutubePlugin({ enabled: false }, 'workspace1')
  expect(disabledPlugin.isEnabled()).toBe(false)
})

test('getParameters returns url parameter', () => {
  const plugin = new YoutubePlugin({ enabled: true }, 'workspace1')
  const params = plugin.getParameters()

  expect(params).toHaveLength(1)
  expect(params[0].name).toBe('url')
  expect(params[0].type).toBe('string')
  expect(params[0].required).toBe(true)
})

test('execute calls window.api.youtube.getTranscript', async () => {
  const mockResult = {
    title: 'Test Video',
    channel: 'Test Channel',
    transcript: 'Hello World'
  }

  window.api.youtube = {
    getTranscript: vi.fn().mockResolvedValue(mockResult)
  }

  const plugin = new YoutubePlugin({ enabled: true }, 'workspace1')
  const result = await plugin.execute({} as any, { url: 'https://www.youtube.com/watch?v=abc123' })

  expect(window.api.youtube.getTranscript).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc123')
  expect(result.title).toBe('Test Video')
  expect(result.channel).toBe('Test Channel')
  expect(result.content).toBe('Hello World')
})

test('execute returns error message on failure', async () => {
  window.api.youtube = {
    getTranscript: vi.fn().mockRejectedValue(new Error('Video not found'))
  }

  const plugin = new YoutubePlugin({ enabled: true }, 'workspace1')
  const result = await plugin.execute({} as any, { url: 'https://www.youtube.com/watch?v=invalid' })

  expect(result.error).toBe('Video not found')
})

test('getCompletedDescription returns error message on failure', () => {
  const plugin = new YoutubePlugin({ enabled: true }, 'workspace1')
  const desc = plugin.getCompletedDescription('get_youtube_transcript', {}, { error: 'Failed' })
  expect(desc).toBe('plugins.youtube.error')
})

test('getCompletedDescription returns success message with title', () => {
  const plugin = new YoutubePlugin({ enabled: true }, 'workspace1')
  const desc = plugin.getCompletedDescription('get_youtube_transcript', {}, { title: 'My Video', content: 'transcript' })
  expect(desc).toBe('plugins.youtube.completed')
})

test('getRunningDescription returns correct message', () => {
  const plugin = new YoutubePlugin({ enabled: true }, 'workspace1')
  const desc = plugin.getRunningDescription()
  expect(desc).toBe('plugins.youtube.running')
})
