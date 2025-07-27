import { describe, it, expect, vi, beforeEach } from 'vitest'
import STTSoniox from '../../src/voice/stt-soniox'

const makeConfig = (overrides: any = {}) => ({
  stt: {
    model: 'stt-async-preview',
    soniox: {
      asyncModel: 'stt-async-preview',
      realtimeModel: 'stt-rt-preview',
      languageHints: [],
      endpointDetection: false,
      cleanup: true,
      audioFormat: 'auto',
      proxy: 'temporary_key',
      tempKeyExpiry: 60,
    },
  },
  engines: {
    soniox: { apiKey: 'test-api-key' },
  },
  ...overrides,
})

describe('STTSoniox', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('async transcription happy path', async () => {
    const engine = new STTSoniox(makeConfig() as any)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'file-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tr-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'hello world' }) })
      .mockResolvedValue({ ok: true, json: async () => ({}) })

    global.fetch = fetchMock
    const { text } = await engine.transcribe(new Blob(['abc']))
    expect(text).toBe('hello world')
  })

  it('realtime streaming aggregates tokens', async () => {
    const engine = new STTSoniox(makeConfig() as any)
    class MockWebSocket {
      readyState = 0
      onopen: any
      onmessage: any
      onerror: any
      onclose: any
      constructor(public url: string) {
        setTimeout(() => {
          this.readyState = 1
          this.onopen?.()
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({
                tokens: [
                  { text: 'Hallo ', is_final: false },
                  { text: 'Welt', is_final: true },
                ],
              }),
            })
            setTimeout(() => {
              this.readyState = 3
              this.onclose?.()
            }, 10)
          }, 10)
        }, 10)
      }
      send() {}
    }

    // @ts-expect-error mocking
    global.WebSocket = MockWebSocket
    const chunks: any[] = []
    await engine.startStreaming('stt-rt-preview', (c) => chunks.push(c))
    await new Promise((res) => setTimeout(res, 120))
    const texts = chunks.filter((c) => c.type === 'text')
    expect(texts.at(-1)?.content.trim()).toBe('WeltHallo')
  })
})
