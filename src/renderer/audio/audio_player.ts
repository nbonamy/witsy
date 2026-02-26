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
  audioEl: HTMLAudioElement|null
  playRequestId: number

  constructor(config: Configuration) {
    this.config = config
    this.listeners = []
    this.player = null
    this.state = 'idle'
    this.uuid = null
    this.objectUrl = null
    this.audioEl = null
    this.playRequestId = 0
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

    // track this play request
    const currentRequestId = ++this.playRequestId

    // set status
    this.uuid = uuid
    this.state = 'loading'
    this.audioEl = audioEl
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
          if (this.uuid !== uuid) {
            return
          }
          this.state = 'playing'
          this.emitStatus()
        },
        onPause: () => {
          if (this.uuid !== uuid) {
            return
          }
          this.state = 'paused'
          this.emitStatus()
        },
        onChunkEnd: () => {
          if (this.uuid !== uuid) {
            return
          }
          this.stop()
        },
        mimeType: response.mimeType ?? 'audio/mpeg',
      })
      await this.player.init()

      // ensure this play request is still current after player init
      if (this.uuid !== uuid || this.playRequestId !== currentRequestId) {
        return true
      }

      if (typeof response.content === 'string') {

        // If the string is already a data URL, use it directly.
        if (/^data:audio\//i.test(response.content)) {
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

          const base64 = trimmed.replace(/\s+/g, '')
          if (typeof atob === 'function' && base64Regex.test(base64)) {
            try {
              binary = atob(base64)
            } catch {
              // Fallback: treat payload as binary-like string.
              binary = response.content
            }
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

        const handleEnded = () => {
          audioEl.removeEventListener('ended', handleEnded)
          if (this.uuid !== uuid) return
          this.stop()
        }
        audioEl.addEventListener('ended', handleEnded)

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
          if (this.uuid !== uuid || this.playRequestId !== currentRequestId) {
            return true
          }

          if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl)
          }
          this.objectUrl = URL.createObjectURL(blob)
          audioEl.src = this.objectUrl

          const handleEnded = () => {
            audioEl.removeEventListener('ended', handleEnded)
            if (this.uuid !== uuid) return
            this.stop()
          }
          audioEl.addEventListener('ended', handleEnded)

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

        const reader = response.content.getReader()
        const currentPlayer = this.player
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (!currentPlayer || this.player !== currentPlayer) {
              await reader.cancel()
              break
            }
            currentPlayer.feed(value)
          }
        } finally {
          reader.releaseLock()
        }

      } else if (
        response.content &&
        typeof (response.content as any)[Symbol.asyncIterator] === 'function'
      ) {
        const iterable = response.content as AsyncIterable<Uint8Array>
        const currentPlayer = this.player
        for await (const chunk of iterable) {
          if (!currentPlayer || this.player !== currentPlayer) break;
          currentPlayer.feed(chunk);
        }

      } else {
        throw new Error('Invalid response format')
      }

      return true

    } catch (e) {
      console.error(e)
      // Only stop if this error belongs to the currently active play request.
      if (this.playRequestId === currentRequestId && this.uuid === uuid) {
        this.stop()
      }
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

    if (this.audioEl) {
      this.audioEl.pause()
      try {
        this.audioEl.currentTime = 0
      } catch {
        // ignore if not supported
      }
    }
    this.audioEl = null

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
