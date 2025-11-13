

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
        mimeType: 'audio/mpeg',
      })
      await this.player.init()

      if (typeof response.content === 'string') {

        // SpeechPlayer cannot play wav files
        // but it is connected to the audio element
        // so commands and events can be used
        audioEl.src = response.content as string
        audioEl.play()

      } else if (response.content instanceof Response) {
        this.player.feedWithResponse(response.content)
      } else if (response.content instanceof ReadableStream) {
        const reader = response.content.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!this.player) break;
          this.player.feed(value);
        }
      } else if ('read' in response.content) {
        for await (const chunk of response.content as AsyncIterable<Uint8Array>) {
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
