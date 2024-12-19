<template>
  <div class="realtime">

    <form onsubmit="return false">
      <div class="toolbar group">
        <select class="tool" v-model="model" @change="save">
          <option v-for="model in models" :value="model.id" :key="model.id">{{ model.name }}</option>
        </select>
        <select class="tool" v-model="voice" @change="save">
          <option value="ash">Ash</option>
          <option value="ballad">Ballad</option>
          <option value="coral">Coral</option>
          <option value="sage">Sage</option>
          <option value="verse">Verse</option>
        </select>
      </div>
    </form>

    <div class="content">

      <div class="status">{{ status }}</div>

      <!-- <div class="transcript">
        <div v-for="word in lastWords" :key="word" class="word" v-html="word" />
      </div> -->

      <div class="blobs" :class="state" @click="onStart">
        <div class="blob blob1"></div>
        <div class="blob blob2"></div>
      </div>

      <div class="cost-container">
        <div class="total">
          <div class="title">Estimated cost:</div>
          <div class="value">$ {{ sessionTotals.cost.total.toFixed(6) }}</div>
          <div class="note">based on<br>gpt-4o-realtime-preview-2024-12-17<br>
            <a href="https://openai.com/api/pricing" target="_blank">costs</a> as of 19-Dec-2024</div>
        </div>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">

import { Ref, ref, computed, onMounted } from 'vue'
import { store } from '../services/store'
import { type RealtimeVoice } from '../types/config.d'
import useTipsManager from '../composables/tips_manager'

store.load()
const tipsManager = useTipsManager(store)

type Cost = {
  input: number,
  output: number
  total: number
}

type Stats = {
  audioInputTokens: number,
  textInputTokens: number,
  cachedInputTokens: number,
  audioOutputTokens: number,
  textOutputTokens: number
  cost?: Cost
}

let peerConnection: RTCPeerConnection = null
let audioContext: AudioContext = null
let audioStream: MediaStream = null

const sessionTotals: Ref<Stats> = ref({
  audioInputTokens: 0,
  textInputTokens: 0,
  cachedInputTokens: 0,
  audioOutputTokens: 0,
  textOutputTokens: 0,
  cost: {
    input: 0,
    output: 0,
    total: 0
  }
})

const model: Ref<string> = ref(store.config.engines.openai.realtime.model || 'davinci')
const voice: Ref<RealtimeVoice> = ref(store.config.engines.openai.realtime.voice || 'ash')
const status = ref('Click the blob to start chatting')
const state: Ref<'idle'|'active'> = ref('idle')
const lastWords: Ref<string[]> = ref(['bon', 'jour', ' nicolas'])

const models = computed(() => {
  return store.config.engines.openai.models.chat.filter(m => m.id.includes('realtime'))
})

let blobTimeout: NodeJS.Timeout
let simInterval: NodeJS.Timeout

onMounted(() => {

  // cleanup on page unload
  window.addEventListener('beforeunload', stopSession)

  // blob animation
  updateBlob()

  // tip
  setTimeout(() => {
    if (tipsManager.isTipAvailable('realtime')) {
      tipsManager.showTip('realtime')
    }
  }, 1000)

})

const createRealtimeSession = async (inStream: MediaStream, token: String, voice: String) => {

  const pc = new RTCPeerConnection()

  pc.ontrack = e => {
    const audio = new Audio()
    audio.srcObject = e.streams[0]
    audio.play()
  }

  pc.addTrack(inStream.getTracks()[0])

  const dc = pc.createDataChannel('oai-events')
  dc.addEventListener('message', (e) => {
    try {

      updateBlob()

      const eventData = JSON.parse(e.data)

      // logging
      addEventToLog(eventData)

      // word tracking
      if (eventData.type === 'response.audio_transcript.delta') {
        lastWords.value.push(eventData.delta)
        if (lastWords.value.length > 5) {
          lastWords.value.shift()
        }
      }
    
      // usage / cost
      if (eventData.type === 'response.done' &&
        eventData.response &&
        eventData.response.usage) {
        const usage = eventData.response.usage
        const inputDetails = usage.input_token_details
        const outputDetails = usage.output_token_details
        const cachedDetails = inputDetails.cached_tokens_details

        const currentStats: Stats = {
          audioInputTokens: inputDetails.audio_tokens - cachedDetails.audio_tokens,
          textInputTokens: inputDetails.text_tokens - cachedDetails.text_tokens,
          cachedInputTokens: inputDetails.cached_tokens,
          audioOutputTokens: outputDetails.audio_tokens,
          textOutputTokens: outputDetails.text_tokens
        }

        // log
        console.log(currentStats)

        // update session totals
        const costs = calculateCosts(currentStats)
        updateSessionTotals(currentStats, costs)
      }

    
    } catch (err) {
      console.error('Error parsing event data:', err)
    }
  })

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/sdp'
  }

  const opts = {
    method: 'POST',
    body: offer.sdp,
    headers
  }

  const model = store.config.engines.openai.realtime.model
  const resp = await fetch(`https://api.openai.com/v1/realtime?model=${model}&voice=${voice}`, opts)

  await pc.setRemoteDescription({
    type: 'answer',
    sdp: await resp.text()
  })

  return pc
}

const calculateCosts = ({ audioInputTokens, textInputTokens, cachedInputTokens, audioOutputTokens, textOutputTokens }: Stats): Cost => {

  // from https://openai.com/api/pricing
  // for gpt-4o-realtime-preview-2024-12-17
  const AUDIO_INPUT_COST = 0.00004
  const AUDIO_OUTPUT_COST = 0.00008
  const CACHED_AUDIO_COST = 0.0000025
  const TEXT_INPUT_COST = 0.0000025
  const TEXT_OUTPUT_COST = 0.00001

  const audioInputCost = audioInputTokens * AUDIO_INPUT_COST
  const cachedInputCost = cachedInputTokens * CACHED_AUDIO_COST
  const textInputCost = textInputTokens * TEXT_INPUT_COST
  const audioOutputCost = audioOutputTokens * AUDIO_OUTPUT_COST
  const textOutputCost = textOutputTokens * TEXT_OUTPUT_COST

  return {
    input: audioInputCost + cachedInputCost + textInputCost,
    output: audioOutputCost + textOutputCost,
    total: audioInputCost + cachedInputCost + textInputCost + audioOutputCost + textOutputCost
  }
}

const updateSessionTotals = (currentStats: Stats, costs: Cost) => {
  sessionTotals.value.audioInputTokens += currentStats.audioInputTokens
  sessionTotals.value.textInputTokens += currentStats.textInputTokens
  sessionTotals.value.cachedInputTokens += currentStats.cachedInputTokens
  sessionTotals.value.audioOutputTokens += currentStats.audioOutputTokens
  sessionTotals.value.textOutputTokens += currentStats.textOutputTokens
  sessionTotals.value.cost.input += costs.input
  sessionTotals.value.cost.output += costs.output
  sessionTotals.value.cost.total += costs.total
}

const addEventToLog = (eventData: any) => {
  //console.log(new Date().toISOString(), eventData);
}

const startSession = async () => {
  try {

    //status.className = 'status'
    status.value = 'Requesting microphone access...'
    state.value = 'active'

    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    })

    status.value = 'Establishing connection...'

    peerConnection = await createRealtimeSession(
      audioStream,
      store.config.engines.openai.apiKey,
      voice.value
    )

    // simInterval = setInterval(() => {
    //   //updateBlob()
    // }, 250)

    //status.className = 'status success'
    status.value = 'Session established successfully!'

  } catch (err) {
    //status.className = 'status error'
    status.value = `Error: ${err.message}`
    console.error('Session error:', err)
    stopSession()
  }
}

const stopSession = () => {
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }

  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop())
    audioStream = null
  }

  if (simInterval) {
    clearInterval(simInterval)
    simInterval = null
  }

  // done
  state.value = 'idle'
}

const onStart = () => {
  if (peerConnection || simInterval) {
    stopSession()
  } else {
    startSession()
  }
}

let transforms = [
  [0, 1, 50, 50, 50, 50],
  [0, 1, 50, 50, 50, 50],
]

const random = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));
const remain = (n: number) => 100 - n;

const updateBlob = () => {

  clearTimeout(blobTimeout);
  
  const offset = state.value === 'active' ? 40 : 40;
  const scaling = state.value === 'active' ? 100 : 50;
  const delay = state.value === 'active' ? 250 : 2000;

  document.querySelectorAll<HTMLElement>('.blob').forEach((blob, idx) => {

    let rotation = transforms[idx][0]
    rotation += random(0, state.value === 'active' ? 15 : 5);
    transforms[idx][0] = rotation;

    let scale = transforms[0][1];
    if (idx === 0) {
      scale += random(-scaling, scaling)/1000;
      scale = Math.max(0.95, Math.min(scale, 1.05));
      transforms[idx][1] = scale;
    }

    let r = [];
    for (let i = 0; i < 4; i++) {
      let v = transforms[idx][i+2];
      v += random(-5, 5);
      v = Math.max(offset, Math.min(v, remain(offset)));
      transforms[idx][i+2] = v;
      r.push(v);
      r.push(remain(v));
    }

    let coordinates = `${r[0]}% ${r[1]}% ${r[2]}% ${r[3]}% / ${r[4]}% ${r[6]}% ${r[7]}% ${r[5]}%`;
    blob.style.borderRadius = coordinates;
    blob.style.setProperty("--r", `${rotation}deg`);
    blob.style.setProperty("--s", `${scale}`);
    blob.style.setProperty("transition", `linear ${delay}ms`);

  });

  blobTimeout = setTimeout(updateBlob, delay);

};

const save = () => {
  store.config.engines.openai.realtime.model = model.value
  store.config.engines.openai.realtime.voice = voice.value
  store.saveSettings()
}

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

.realtime {
  height: 100vh;
  background-color: var(--window-bg-color);
  color: var(--text-color);
  font-size: 14pt;
  padding: 0px 8px;
  -webkit-app-region: drag;
}

.realtime * {
  -webkit-app-region: no-drag;
}

.macos form .toolbar {
  padding-left: 90px;
}

form .toolbar {

  display: flex;
  flex-direction: row;
  height: 32px;
  margin: 0px;
  padding: 8px 16px;
  align-items: center;
  background-color: var(--dialog-header-bg-color);
  border-bottom: 1px solid var(--scratchpad-bars-border-color);
  -webkit-app-region: drag;
  gap: 10px;

  .tool {

    max-width: 128px;
    white-space: nowrap;
    padding: 6px 8px;
    font-size: 11pt;
    margin: 0;

    &:enabled {
      -webkit-app-region: no-drag;
    }

    svg {
      position: relative;
      margin-right: 8px;
      top: 2px;
    }

  }

  select.tool {
    border-radius: 6px;
    font-size: 10pt;
    padding-right: 0px;
    width: auto;
  }

}

.content {
  height: calc(100% - 50px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.status {
  margin-bottom: 2rem;
}

.transcript {
  display: flex;
  flex-direction: row;
  justify-content: center;
  margin-bottom: 20px;
}

.blobs {
  cursor: pointer;
  position: relative;
  width: 300px;
  height: 300px;
}

.blob {
  position: absolute;
  width: 300px;
  height: 300px;
  left: 0;
  top: 0;
  border-radius: 50%;
  overflow: hidden;
  transform: rotate(var(--r, 0)) scale(var(--s, --s));
}

.blob {
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0);
}

.blob1 {
  background: var(--text-color);
  opacity: 0.8;
}

.blob2 {
  background: var(--icon-color);
  opacity: 0.9;
}

.blobs.active .blob2 {
  background-color: var(--highlight-color);
  opacity: 0.5;
}

.blob, .blob div {
  transition-property: border-radius, transform;
}

.cost-container {
  text-align: center;
  margin-top: 2rem;
  font-size: 10pt;

  .value {
    margin: 4px 0px;
    font-size: 14pt;
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }
  .note {
    font-size: 9pt;
  }
}

</style>