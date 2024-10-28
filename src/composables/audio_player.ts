

import { Configuration } from 'types/config.d'
import { SpeechPlayer } from 'openai-speech-stream-player'
import Tts from '../voice/tts'

export type AudioState = 'idle'|'loading'|'playing'|'paused'
export type AudioStatus = { state: AudioState, uuid: string }
export type AudioStatusListener = (status: AudioStatus) => void

class AudioPlayer {

  config: Configuration
  listeners: AudioStatusListener[]
  player: SpeechPlayer
  state: AudioState
  uuid: string

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
      const tts = new Tts(this.config)
      const response = await tts.synthetize(content)

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
        mimeType: 'audio/mpeg',
      })
      await this.player.init()
      this.player.feedWithResponse(response.content)

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

let instance: AudioPlayer = null
export default function useAudioPlayer(config: Configuration) {
  if (!instance) {
    instance = new AudioPlayer(config)
  }
  return instance
}

export const textMaxLength = Tts.textMaxLength
