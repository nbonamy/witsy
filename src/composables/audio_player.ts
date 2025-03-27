

import { type Configuration } from '../types/config'
import { SpeechPlayer } from 'openai-speech-stream-player'
import getTTSEngine, { textMaxLength as importedTextMaxLength, SynthesisResponse } from '../voice/tts'

export type AudioState = 'idle'|'loading'|'playing'|'paused'
export type AudioStatus = { state: AudioState, uuid: string }
export type AudioStatusListener = (status: AudioStatus) => void

class AudioPlayer {

  config: Configuration
  listeners: AudioStatusListener[]
  player: SpeechPlayer|null
  state: AudioState
  uuid: string|null

  constructor(config: Configuration) {
    this.config = config
    this.listeners = []
    this.player = null
    this.state = 'idle'
    this.uuid = null
  }

  addListener(listener: AudioStatusListener) {
    this.listeners.push(listener)
  }

  removeListener(listener: AudioStatusListener) {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  async play(audioEl: HTMLAudioElement, uuid: string, content: string) {

    // if same id is playing, stop
    if (this.uuid == uuid && this.state != 'idle') {
      this.stop()
      return
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
        return
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

      if (response.content instanceof Blob) {
        const objectURL = URL.createObjectURL(response.content)
        audioEl.src = objectURL
        audioEl.play()
      } else if (response.content instanceof Response) {
        this.player.feedWithResponse(response.content)
      } else if ('read' in response.content) {
        for await (const chunk of response.content) {
          this.player.feed(chunk);
        }
      } else {
        throw new Error('Invalid response format')
      }

    } catch (e) {
      console.error(e)
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
