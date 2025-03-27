
import { Configuration } from '../types/config'
import { SynthesisResponse, TTSEngine } from './tts'
import * as lamejs from '@breezystack/lamejs'
import { fal } from '@fal-ai/client'

export default class TTSFalAi implements TTSEngine {

  config: Configuration

  static readonly models = [
    { id: 'fal-ai/kokoro/american-english', label: 'Kokoro American English' },
    { id: 'fal-ai/kokoro/british-english', label: 'Kokoro British English' },
    { id: 'fal-ai/kokoro/spanish', label: 'Kokoro Spanish' },
    { id: 'fal-ai/kokoro/french', label: 'Kokoro French' },
    { id: 'fal-ai/kokoro/italian', label: 'Kokoro Italian' },
    { id: 'fal-ai/kokoro/brazilian-portuguese', label: 'Kokoro Brazilian Portuguese' },
    { id: 'fal-ai/kokoro/mandarin-chinese', label: 'Kokoro Mandarin Chinese' },
    { id: 'fal-ai/kokoro/japanese', label: 'Kokoro Japanese' },
    { id: 'fal-ai/kokoro/hindi', label: 'Kokoro Hindi' },
    //{ id: 'fal-ai/elevenlabs/tts/turbo-v2.5', label: 'ElevenLabs TTS Turbo v2.5' },
    //{ id: 'fal-ai/playai/tts/v3', label: 'PlayAI TTS v3' },
  ]

  static readonly voices = (model: string) => {

    // american english
    if (model === 'fal-ai/kokoro/american-english') {
      return [
        { id: 'af_heart', label: 'Heart' },
        { id: 'af_alloy', label: 'Alloy' },
        { id: 'af_aoede', label: 'Aoede' },
        { id: 'af_bella', label: 'Bella' },
        { id: 'at_jessica', label: 'Jessica' },
        { id: 'af_kore', label: 'Kore' },
        { id: 'v af_nicole', label: 'Nicole' },
        { id: 'af_nova', label: 'Nova' },
        { id: 'af_river', label: 'River' },
        { id: 'af_sarah', label: 'Sarah' },
        { id: 'af_sky', label: 'Sky' },
        { id: 'am_adam', label: 'Adam' },
        { id: 'am_echo', label: 'Echo' },
        { id: 'am_eric', label: 'Eric' },
        { id: 'am_fenrir', label: 'Fenrir' },
        { id: 'am_liam', label: 'Liam' },
        { id: 'am_michael', label: 'Michael' },
        { id: 'am_onyx', label: 'Onyx' },
        { id: 'am_puck', label: 'Puck' },
        { id: 'am_santa', label: 'Santa' },
      ]
    }

    // british english
    if (model === 'fal-ai/kokoro/british-english') {
      return [
        { id: 'bf_alice', label: 'Alice' },
        { id: 'bf_emma', label: 'Emma' },
        { id: 'bf_isabella', label: 'Isabella' },
        { id: 'bf_lily', label: 'Lily' },
        { id: 'bm_daniel', label: 'Daniel' },
        { id: 'bm_fable', label: 'Fable' },
        { id: 'bm_george', label: 'George' },
        { id: 'bm_lewis', label: 'Lewis' },
      ]
    }

    // spanish
    if (model === 'fal-ai/kokoro/spanish') {
      return [
        { id: 'ef_dora', label: 'Dora' },
        { id: 'em_alex', label: 'Alex' },
        { id: 'em_santa', label: 'Santa' }
      ]
    }

    // french
    if (model === 'fal-ai/kokoro/french') {
      return [
        { id: 'ff_siwis', label: 'Swiss' },
      ]
    }

    // italian
    if (model === 'fal-ai/kokoro/italian') {
      return [
        { id: 'if_sara', label: 'Sara' },
        { id: 'im_nicola', label: 'Nicola' }
      ]
    }

    // brazilian portuguese
    if (model === 'fal-ai/kokoro/brazilian-portuguese') {
      return [
        { id: 'pf_dora', label: 'Dora' },
        { id: 'pm_alex', label: 'Alex' },
        { id: 'pm_santa', label: 'Santa' }
      ]
    }

    // mandarin chinese
    if (model === 'fal-ai/kokoro/mandarin-chinese') {
      return [
        { id: 'zf_xiaobei', label: 'Xiaobei' },
        { id: 'zf_xiaoni', label: 'Xiaoni' },
        { id: 'zf_xiaoxiao', label: 'Xiaoxiao' },
        { id: 'zt_xiaoyi', label: 'Xiaoyi' },
        { id: 'zm_yunjian', label: 'Yunjian' },
        { id: 'zm_yunxi', label: 'Yunxi' },
        { id: 'zm_yunxia', label: 'Yunxia' },
        { id: 'zm_yunyang', label: 'Yunyang' }
      ]
    }

    // japanese
    if (model === 'fal-ai/kokoro/japanese') {
      return [
        { id: 'jf_alpha', label: 'Alpha' },
        { id: 'if_gongitsune', label: 'Gongitsune' },
        { id: 'jf_nezumi', label: 'Nezumi' },
        { id: 'j_tebukuro', label: 'Tebukuro' },
        { id: 'jm_kumo', label: 'Kumo' },
      ]
    }

    // hindi
    if (model === 'fal-ai/kokoro/hindi') {
      return [
        { id: 'hf_alpha', label: 'Alpha' },
        { id: 'hf_beta', label: 'Beta' },
        { id: 'hm_omega', label: 'Omega' },
        { id: 'hm_psi', label: 'Psi' }
     ]
    }

    // default
    return [{ id: '', label: 'Default' }]
  }

  constructor(config: Configuration) {
    this.config = config
  }

  async synthetize(text: string, opts?: { model?: string, voice?: string }): Promise<SynthesisResponse> {

    // set api key
    fal.config({
      credentials: this.config.engines.falai.apiKey
    });

    // call
    const response = await fal.subscribe(opts?.model || this.config.tts.model, {
      input: {
        text: text,
        prompt: text,
        input: text,
        voice: opts?.voice || this.config.tts.voice || undefined
      },
    });

    // get the audio data
    const audioResponse = await fetch(response.data.audio.url);

    // if response is already mpeg then it is easy
    if (response.data.audio.content_type === 'audio/mpeg') {
      return {
        type: 'audio',
        mimeType: 'audio/mpeg',
        content: audioResponse
      }
    }

    // decode wav
    const audioBuffer = await audioResponse.arrayBuffer();
    //@ts-expect-error unsure but it works!
    const wav = lamejs.WavHeader.readHeader(new DataView(audioBuffer));
    const samples = new Int16Array(audioBuffer, wav.dataOffset, wav.dataLen / 2);
    const sampleBlockSize = 1152

    // encode to mp3
    const mp3Data = [];
    const mp3Encoder = new lamejs.Mp3Encoder(wav.channels, wav.sampleRate, 128);
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
      const sampleChunk = samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3Encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
      }
    }
    
    // finish writing mp3
    const mp3buf = mp3Encoder.flush();
    if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
    }
    
    // const blob = new Blob(mp3Data, { type: 'audio/mp3' });
    // const base64 = await new Promise<string>((resolve, reject) => {
    //   const reader = new FileReader();
    //   reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    //   reader.onerror = reject;
    //   reader.readAsDataURL(blob);
    // });
    // saveFileContents('.mp3', base64);
    
    // return mp3
    return {
      type: 'audio',
      mimeType: 'audio/mpeg',
      content: new Blob(mp3Data, { type: 'audio/mp3' })
    };


  }

}
