import { describe, it, expect, vi, beforeEach } from 'vitest'
import STTApple from '@renderer/voice/stt-apple'

const makeConfig = (overrides: any = {}) => ({
  stt: {
    engine: 'apple',
    model: 'SpeechAnalyzer',
    locale: 'en-US',
  },
  engines: {},
  ...overrides,
})

// Mock window.api
global.window = {
  api: {
    platform: 'darwin',
    transcribe: {
      appleCli: vi.fn(),
    },
  },
} as any

// Mock webm-to-wav-converter
vi.mock('webm-to-wav-converter', () => ({
  getWaveBlob: vi.fn(async (blob) => {
    // Return a mock WAV blob with arrayBuffer method
    const mockBlob = new Blob(['wav-data'], { type: 'audio/wav' })
    // Add arrayBuffer method if not present
    if (!mockBlob.arrayBuffer) {
      Object.defineProperty(mockBlob, 'arrayBuffer', {
        value: async () => new ArrayBuffer(8)
      })
    }
    return mockBlob
  }),
}))

describe('STTApple', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('should have correct locale definitions', () => {
    expect(STTApple.locales).toBeDefined()
    expect(STTApple.locales.length).toBe(42)
    expect(STTApple.locales[0]).toEqual({ id: 'ar-SA', label: 'Arabic (Saudi Arabia)' })
    expect(STTApple.locales.find(l => l.id === 'en-US')).toEqual({ id: 'en-US', label: 'English (United States)' })
  })

  it('should return correct name', () => {
    const engine = new STTApple(makeConfig() as any)
    expect(engine.name).toBe('apple')
  })

  it('should be ready on macOS', () => {
    const engine = new STTApple(makeConfig() as any)
    expect(engine.isReady()).toBe(true)
  })

  it('should not be ready on non-macOS', () => {
    // @ts-expect-error mocking
    global.window.api.platform = 'win32'
    const engine = new STTApple(makeConfig() as any)
    expect(engine.isReady()).toBe(false)

    // Restore
    // @ts-expect-error mocking
    global.window.api.platform = 'darwin'
  })

  it('should not support streaming', () => {
    const engine = new STTApple(makeConfig() as any)
    expect(engine.isStreamingModel('SpeechAnalyzer')).toBe(false)
  })

  it('should not require download', () => {
    expect(STTApple.requiresDownload()).toBe(false)

    const engine = new STTApple(makeConfig() as any)
    expect(engine.requiresDownload()).toBe(false)
  })

  it('should initialize with callback', async () => {
    const engine = new STTApple(makeConfig() as any)
    const callback = vi.fn()

    await engine.initialize(callback)

    expect(callback).toHaveBeenCalledWith({
      status: 'ready',
      task: 'apple',
      model: 'SpeechAnalyzer'
    })
  })

  it('should transcribe audio blob successfully', async () => {
    const engine = new STTApple(makeConfig() as any)

    // Mock the IPC response
    const mockAppleCli = vi.fn().mockResolvedValue({
      text: 'Hello world',
      error: undefined,
    })
    // @ts-expect-error mocking
    global.window.api.transcribe.appleCli = mockAppleCli

    const audioBlob = new Blob(['audio data'], { type: 'audio/webm' })
    const result = await engine.transcribe(audioBlob)

    expect(result).toEqual({ text: 'Hello world' })

    // Should have called IPC with ArrayBuffer and options
    expect(mockAppleCli).toHaveBeenCalledTimes(1)
    const [arrayBuffer, options] = mockAppleCli.mock.calls[0]
    expect(arrayBuffer).toBeInstanceOf(ArrayBuffer)
    expect(options).toEqual({ locale: 'en-US', live: false })
  })

  it('should pass empty locale when not configured', async () => {
    const configWithoutLocale = makeConfig()
    configWithoutLocale.stt.locale = ''
    const engine = new STTApple(configWithoutLocale as any)

    const mockAppleCli = vi.fn().mockResolvedValue({
      text: 'Test',
      error: undefined,
    })
    // @ts-expect-error mocking
    global.window.api.transcribe.appleCli = mockAppleCli

    const audioBlob = new Blob(['audio data'])
    await engine.transcribe(audioBlob)

    const [, options] = mockAppleCli.mock.calls[0]
    expect(options.locale).toBe('')
  })

  it('should handle transcription errors', async () => {
    const engine = new STTApple(makeConfig() as any)

    // Mock IPC to return error
    const mockAppleCli = vi.fn().mockResolvedValue({
      text: '',
      error: 'CLI exited with code 1',
    })
    // @ts-expect-error mocking
    global.window.api.transcribe.appleCli = mockAppleCli

    const audioBlob = new Blob(['audio data'])

    await expect(engine.transcribe(audioBlob)).rejects.toThrow('CLI exited with code 1')
  })

  it('should handle IPC rejection', async () => {
    const engine = new STTApple(makeConfig() as any)

    // Mock IPC to throw
    const mockAppleCli = vi.fn().mockRejectedValue(new Error('IPC failed'))
    // @ts-expect-error mocking
    global.window.api.transcribe.appleCli = mockAppleCli

    const audioBlob = new Blob(['audio data'])

    await expect(engine.transcribe(audioBlob)).rejects.toThrow('IPC failed')
  })

  it('should report models as always downloaded', async () => {
    const engine = new STTApple(makeConfig() as any)
    expect(await engine.isModelDownloaded('SpeechAnalyzer')).toBe(true)
    expect(await engine.isModelDownloaded('any-model')).toBe(true)
  })

  it('should have no-op deleteModel', async () => {
    const engine = new STTApple(makeConfig() as any)
    const result = await engine.deleteModel('SpeechAnalyzer')
    expect(result).toBeUndefined()
  })

  it('should have no-op deleteAllModels', async () => {
    const engine = new STTApple(makeConfig() as any)
    const result = await engine.deleteAllModels()
    expect(result).toBeUndefined()
  })
})
