import { type Configuration } from 'types/config'
import { SynthesisResponse } from '../voice/tts-engine'
import getTTSEngine, { textMaxLength as importedTextMaxLength } from '../voice/tts'
import { SpeechPlayer } from 'openai-speech-stream-player'

export type AudioState = 'idle'|'loading'|'playing'|'paused'
export type AudioStatus = { state: AudioState, uuid: string }
export type AudioStatusListener = (status: AudioStatus) => void

class AudioPlayer {

  config: Configuration
  listeners: AudioStatusListener[]
  player: SpeechPlayer|null
  state: AudioState
  uuid: string|null
  objectUrl: string|null

  constructor(config: Configuration) {
    this.config = config
    this.listeners = []
    this.player = null
    this.state = 'idle'
    this.uuid = null
    this.objectUrl = null
  }

  addListener(listener: AudioStatusListener) {
    this.listeners.push(listener)
  }

  removeListener(listener: AudioStatusListener) {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  async play(audioEl: HTMLAudioElement, uuid: string, content: string): Promise<boolean> {

    // if same id is playing, stop
    if (this.uuid == uuid && this.state != 'idle') {
      this.stop()
      return true
    }

    // if not same message 1st thing is to stop
    if (this.state != 'idle' && uuid != this.uuid) {
      this.stop()
    }

    // set status
    this.uuid = uuid
    this.state = 'loading'
    this.emitStatus()

    try {

      // get the stream
      const tts = getTTSEngine(this.config)
      const response: SynthesisResponse = await tts.synthetize(content)

      // have we been cancelled
      if (this.uuid != uuid) {
        return true
      }

      // stream it
      this.player = new SpeechPlayer({
        audio: audioEl,
        onPlaying: () => {
          this.uuid = uuid
          this.state = 'playing'
          this.emitStatus()
        },
        onPause: () => {
          this.state = 'paused'
          this.emitStatus()
        },
        onChunkEnd: () => {
          this.stop()
        },
        mimeType: response.mimeType ?? 'audio/mpeg',
      })
      await this.player.init()

      if (typeof response.content === 'string') {

        // If the string is already a data URL, use it directly.
        if (response.content.startsWith('data:audio')) {
          if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl)
            this.objectUrl = null
          }
          audioEl.src = response.content
        } else {
          // Detect likely base64 payload (no data URL prefix).
          const trimmed = response.content.trim()
          const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/
          let binary: string

          if (typeof atob === 'function' && base64Regex.test(trimmed.replace(/\s+/g, ''))) {
            const base64 = trimmed.replace(/\s+/g, '')
            const decoded = atob(base64)
            binary = decoded
          } else {
            // Treat as binary-like string (e.g. "RIFF....").
            binary = response.content
          }

          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i) & 0xff
          }
          const mimeType = response.mimeType ?? 'audio/wav'
          const blob = new Blob([bytes], { type: mimeType })
          if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl)
          }
          this.objectUrl = URL.createObjectURL(blob)
          audioEl.src = this.objectUrl
        }

        audioEl.play().catch((err) => {
          // Ignore AbortError caused by rapid play/pause races.
          if (!err || err.name !== 'AbortError') {
            console.error(err)
          }
        })

      } else if (typeof Response !== 'undefined' && response.content instanceof Response) {

        const rawContentType = response.content.headers.get('content-type') || response.mimeType || ''
        const contentType = rawContentType.toLowerCase()

        // If this is a direct audio response (e.g. from /v1/audio/speech), play it via the audio element.
        if (contentType.startsWith('audio/')) {
          const blob = await response.content.blob()

          // Ensure this play request is still current after the async blob read.
          if (this.uuid !== uuid) {
            return true
          }

          if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl)
          }
          this.objectUrl = URL.createObjectURL(blob)
          audioEl.src = this.objectUrl

          await audioEl.play().catch((err) => {
            if (!err || err.name !== 'AbortError') {
              console.error(err)
            }
          })
        } else {
          // Fallback to streaming via SpeechPlayer when not a direct audio payload.
          this.player.feedWithResponse(response.content)
        }

      } else if (typeof ReadableStream !== 'undefined' && response.content instanceof ReadableStream) {

        const reader = response.content.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!this.player) break;
          this.player.feed(value);
        }

      } else if ((response.content as any) && 'read' in (response.content as any)) {

        const iterable = response.content as unknown as AsyncIterable<Uint8Array>
        for await (const chunk of iterable) {
          if (!this.player) break;
          this.player.feed(chunk);
        }

      } else {
        throw new Error('Invalid response format')
      }

      return true

    } catch (e) {
      console.error(e)
      this.stop()
      return false
    }

  }

  playpause(uuid: string) {
    if (this.uuid == uuid) {
      if (this.player?.playing) {
        this.player?.pause()
      } else {
        this.player?.play()
      }
    }
  }
  
  stop() {
    try {
      this.player?.destroy()
    } catch {
      //console.error(e)
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }

    // reset
    this.uuid = null
    this.player = null
    this.state = 'idle'
    this.emitStatus()
  }

  emitStatus() {
    for (const listener of this.listeners) {
      listener?.call(this, {
        state: this.state,
        uuid: this.uuid,
      } as AudioStatus)
    }
  }

}

let instance: AudioPlayer|null = null
export default function useAudioPlayer(config: Configuration) {
  if (!instance) {
    instance = new AudioPlayer(config)
  }
  return instance
}

export const textMaxLength = importedTextMaxLength
