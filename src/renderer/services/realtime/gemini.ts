/**
 * Google Gemini Live implementation using @google/genai SDK
 */

import { GoogleGenAI, Modality, Session } from '@google/genai'
import { Configuration } from 'types/config'
import {
  RealtimeConfig,
  RealtimeCostInfo,
  RealtimeEngine,
  RealtimeEngineCallbacks,
  RealtimeUsage,
  RealtimeVoice,
} from './engine'

export class RealtimeGemini extends RealtimeEngine {

  private config: Configuration
  private session: Session | null = null
  private currentModel: string = ''
  private currentMessageId: string | null = null
  private currentMessageContent: string = ''
  private currentInputTranscript: string = ''
  private currentInputMessageId: string | null = null

  // Audio capture
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null

  // Audio playback
  private playbackContext: AudioContext | null = null
  private nextPlayTime: number = 0

  // Track usage from messages
  private usage: RealtimeUsage = {
    audioInputTokens: 0,
    textInputTokens: 0,
    cachedAudioTokens: 0,
    cachedTextTokens: 0,
    audioOutputTokens: 0,
    textOutputTokens: 0,
  }

  constructor(config: Configuration, callbacks: RealtimeEngineCallbacks) {
    super(callbacks)
    this.config = config
  }

  get supportsTools(): boolean {
    return false
  }

  async connect(realtimeConfig: RealtimeConfig): Promise<void> {
    this.currentModel = realtimeConfig.model
    this.callbacks.onStatusChange('connecting')

    // // console.log('[gemini] connecting with config:', {
    //   model: realtimeConfig.model,
    //   voice: realtimeConfig.voice,
    //   hasInstructions: !!realtimeConfig.instructions,
    // })

    // Reset state
    this.currentMessageId = null
    this.currentMessageContent = ''
    this.usage = {
      audioInputTokens: 0,
      textInputTokens: 0,
      cachedAudioTokens: 0,
      cachedTextTokens: 0,
      audioOutputTokens: 0,
      textOutputTokens: 0,
    }

    const apiKey = this.config.engines.google.apiKey
    // console.log('[gemini] API key present:', !!apiKey, 'length:', apiKey?.length)

    const ai = new GoogleGenAI({ apiKey })

    try {
      // console.log('[gemini] calling ai.live.connect...')
      this.session = await ai.live.connect({
        model: realtimeConfig.model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: realtimeConfig.instructions,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: realtimeConfig.voice }
            }
          },
          // Enable transcription for both input and output
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: async () => {
            // console.log('[gemini] onopen called')
            // Start audio capture after connection is established
            await this.startAudioCapture()
            this.callbacks.onStatusChange('connected')
          },
          onmessage: (message: any) => {
            // console.log('[gemini] onmessage:', JSON.stringify(message, null, 2).slice(0, 500))
            this.handleMessage(message)
          },
          onerror: (e: any) => {
            console.error('[gemini] onerror:', e)
            this.callbacks.onError(new Error(e.message || 'Gemini Live error'))
          },
          onclose: () => {
            this.stopAudioCapture()
            this.callbacks.onStatusChange('idle')
          },
        }
      })
      // console.log('[gemini] ai.live.connect returned, session:', !!this.session)
    } catch (err) {
      console.error('[gemini] connect error:', err)
      throw err
    }
  }

  private async startAudioCapture(): Promise<void> {
    // console.log('[gemini] starting audio capture...')

    try {
      // Get microphone stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Create audio context at 16kHz (Gemini's expected sample rate)
      this.audioContext = new AudioContext({ sampleRate: 16000 })

      // Create worklet for PCM processing
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferSize = 4096;
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
          }

          process(inputs) {
            const input = inputs[0][0];
            if (!input) return true;

            for (let i = 0; i < input.length; i++) {
              this.buffer[this.bufferIndex++] = input[i];

              if (this.bufferIndex >= this.bufferSize) {
                // Convert to 16-bit PCM
                const pcmData = new Int16Array(this.bufferSize);
                for (let j = 0; j < this.bufferSize; j++) {
                  pcmData[j] = Math.max(-1, Math.min(1, this.buffer[j])) * 0x7FFF;
                }

                this.port.postMessage({ type: 'pcm', data: pcmData });
                this.bufferIndex = 0;
              }
            }

            return true;
          }
        }

        registerProcessor('gemini-pcm-processor', PCMProcessor);
      `

      const blob = new Blob([workletCode], { type: 'text/javascript' })
      const workletUrl = URL.createObjectURL(blob)

      await this.audioContext.audioWorklet.addModule(workletUrl)
      this.workletNode = new AudioWorkletNode(this.audioContext, 'gemini-pcm-processor')

      // Handle PCM data from worklet
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'pcm' && this.session) {
          // Convert Int16Array to base64
          const base64 = this.int16ArrayToBase64(event.data.data)

          // Send to Gemini
          this.session.sendRealtimeInput({
            audio: {
              data: base64,
              mimeType: 'audio/pcm;rate=16000'
            }
          })
        }
      }

      // Connect microphone to worklet
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      source.connect(this.workletNode)

      // console.log('[gemini] audio capture started')
    } catch (err) {
      console.error('[gemini] failed to start audio capture:', err)
      throw err
    }
  }

  private stopAudioCapture(): void {
    // console.log('[gemini] stopping audio capture...')

    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }
  }

  private int16ArrayToBase64(int16Array: Int16Array): string {
    const bytes = new Uint8Array(int16Array.buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToInt16Array(base64: string): Int16Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Int16Array(bytes.buffer)
  }

  private async playAudio(base64Data: string): Promise<void> {
    try {
      // Create playback context if needed (24kHz for Gemini output)
      if (!this.playbackContext) {
        this.playbackContext = new AudioContext({ sampleRate: 24000 })
        this.nextPlayTime = this.playbackContext.currentTime
      }

      // Decode base64 to PCM
      const pcmData = this.base64ToInt16Array(base64Data)

      // Convert Int16 PCM to Float32 for Web Audio
      const float32Data = new Float32Array(pcmData.length)
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 0x7FFF
      }

      // Create audio buffer
      const audioBuffer = this.playbackContext.createBuffer(1, float32Data.length, 24000)
      audioBuffer.getChannelData(0).set(float32Data)

      // Schedule immediately - no queue, just schedule at next available time
      const source = this.playbackContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.playbackContext.destination)

      // Schedule playback seamlessly
      const currentTime = this.playbackContext.currentTime
      const startTime = Math.max(currentTime, this.nextPlayTime)
      source.start(startTime)
      this.nextPlayTime = startTime + audioBuffer.duration

    } catch (err) {
      console.error('[gemini] audio playback error:', err)
    }
  }

  private stopPlayback(): void {
    this.nextPlayTime = 0
    if (this.playbackContext) {
      this.playbackContext.close()
      this.playbackContext = null
    }
  }

  close(): void {
    // console.log('[gemini] close called')
    this.stopAudioCapture()
    this.stopPlayback()
    this.session?.close()
    this.session = null
    this.currentMessageId = null
    this.currentMessageContent = ''
  }

  isConnected(): boolean {
    return this.session !== null
  }

  getUsage(): RealtimeUsage {
    return this.usage
  }

  getCostInfo(usage: RealtimeUsage): RealtimeCostInfo {
    // Gemini 2.5 Flash Native Audio pricing (per 1M tokens)
    // https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-native-audio
    // Input: $0.50 (text), $3.00 (audio)
    // Output: $2.00 (text), $12.00 (audio)
    const textInputCost = usage.textInputTokens * 0.0000005    // $0.50/1M
    const audioInputCost = usage.audioInputTokens * 0.000003   // $3.00/1M
    const textOutputCost = usage.textOutputTokens * 0.000002   // $2.00/1M
    const audioOutputCost = usage.audioOutputTokens * 0.000012 // $12.00/1M

    const inputCost = audioInputCost + textInputCost
    const outputCost = audioOutputCost + textOutputCost

    return {
      cost: {
        input: inputCost,
        output: outputCost,
        total: inputCost + outputCost
      },
      pricingModel: 'gemini-2.5-flash-native-audio',
      pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-native-audio',
      pricingDate: '01/11/2026',
    }
  }

  static getAvailableModels(): { id: string, name: string }[] {
    return [
      { id: 'gemini-2.5-flash-native-audio-preview-12-2025', name: 'Gemini 2.5 Flash Native Audio' },
    ]
  }

  static getAvailableVoices(): RealtimeVoice[] {
    // Gemini Live HD voices - subset of the 30 available
    return [
      { id: 'Puck', name: 'Puck' },
      { id: 'Charon', name: 'Charon' },
      { id: 'Kore', name: 'Kore' },
      { id: 'Fenrir', name: 'Fenrir' },
      { id: 'Aoede', name: 'Aoede' },
      { id: 'Leda', name: 'Leda' },
      { id: 'Orus', name: 'Orus' },
      { id: 'Zephyr', name: 'Zephyr' },
    ]
  }

  private handleMessage(message: any): void {
    // Handle serverContent with modelTurn for transcripts
    if (message.serverContent?.modelTurn) {
      const parts = message.serverContent.modelTurn.parts || []

      for (const part of parts) {
        // Handle text content (transcript or reasoning)
        if (part.text) {
          const isThought = part.thought === true
          this.handleTextContent(part.text, isThought ? 'reasoning' : 'content')
        }
        // Handle audio data - play it back
        if (part.inlineData?.data) {
          // Play the audio
          this.playAudio(part.inlineData.data)

          // Track usage - approximate tokens (25 tokens/second at 24kHz)
          const audioBytes = part.inlineData.data.length * 0.75 // Base64 to bytes
          const audioSeconds = audioBytes / (24000 * 2) // 24kHz, 16-bit
          this.usage.audioOutputTokens += Math.round(audioSeconds * 25)
        }
      }
    }

    // Handle turn completion - finalize current message
    if (message.serverContent?.turnComplete) {
      // console.log('[gemini] turn complete')
      // Reset assistant message state
      this.currentMessageId = null
      this.currentMessageContent = ''
      // Reset user message state
      this.currentInputMessageId = null
      this.currentInputTranscript = ''
    }

    // Handle input transcription (user speech) - can be inputTranscript or inputTranscription
    let inputTranscript = message.serverContent?.inputTranscript || message.serverContent?.inputTranscription?.text
    if (inputTranscript) {
      // Remove <noise> tags from transcription
      inputTranscript = inputTranscript.replace(/<noise>/gi, '').trim()
      if (!inputTranscript) return // Skip if only noise

      // console.log('[gemini] input transcript fragment:', inputTranscript)
      // Accumulate input transcription
      this.currentInputTranscript += inputTranscript

      if (!this.currentInputMessageId) {
        // Create new user message
        this.currentInputMessageId = `user-${Date.now()}`
        this.callbacks.onNewMessage({
          id: this.currentInputMessageId,
          role: 'user',
          content: inputTranscript
        })
      } else {
        // Append to existing user message
        this.callbacks.onMessageUpdated(this.currentInputMessageId, inputTranscript, 'append')
      }

      // Approximate input audio tokens
      this.usage.audioInputTokens += Math.round(inputTranscript.length * 0.5)
    }

    // Handle output transcription (model speech) - comes as fragments
    const outputTranscript = message.serverContent?.outputTranscription?.text
    if (outputTranscript) {
      // console.log('[gemini] output transcript fragment:', outputTranscript)
      // Accumulate and append the fragment
      this.currentMessageContent += outputTranscript

      if (!this.currentMessageId) {
        // Create new assistant message
        this.currentMessageId = `assistant-${Date.now()}`
        this.callbacks.onNewMessage({
          id: this.currentMessageId,
          role: 'assistant',
          content: outputTranscript
        })
      } else {
        // Append fragment to existing message
        this.callbacks.onMessageUpdated(this.currentMessageId, outputTranscript, 'append')
      }
    }

    // Handle usage metadata if available
    if (message.usageMetadata) {
      this.updateUsageFromMetadata(message.usageMetadata)
    }

    // Always update usage callback
    this.callbacks.onUsageUpdated(this.getUsage())
  }

  private handleTextContent(text: string, type: 'content' | 'reasoning' = 'content'): void {
    if (!this.currentMessageId) {
      // Start new assistant message
      this.currentMessageId = `assistant-${Date.now()}`
      this.currentMessageContent = text
      this.callbacks.onNewMessage({
        id: this.currentMessageId,
        role: 'assistant',
        content: type === 'reasoning' ? '' : text
      })
      // If reasoning, send it separately
      if (type === 'reasoning') {
        this.callbacks.onMessageUpdated(this.currentMessageId, text, 'append', 'reasoning')
      }
    } else {
      // Append to existing message
      this.currentMessageContent += text
      this.callbacks.onMessageUpdated(this.currentMessageId, text, 'append', type)
    }
  }

  private updateUsageFromMetadata(metadata: any): void {
    // Update from Gemini's usage metadata if available
    if (metadata.promptTokenCount) {
      this.usage.textInputTokens = metadata.promptTokenCount
    }
    if (metadata.candidatesTokenCount) {
      this.usage.textOutputTokens = metadata.candidatesTokenCount
    }
    // Audio tokens come from modality-specific fields
    if (metadata.promptTokenCountDetails?.audioTokenCount) {
      this.usage.audioInputTokens = metadata.promptTokenCountDetails.audioTokenCount
    }
    if (metadata.candidatesTokenCountDetails?.audioTokenCount) {
      this.usage.audioOutputTokens = metadata.candidatesTokenCountDetails.audioTokenCount
    }
  }
}
