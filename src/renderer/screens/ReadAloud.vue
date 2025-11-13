<template>
  <div class="readaloud">
    <PauseCircleIcon v-if="state == 'playing'" @click="onPlayPause()" />
    <PlayCircleIcon v-else-if="state == 'paused'" @click="onPlayPause()" />
    <Loader class="loader" v-else />
    <XCircleIcon @click="onStop()" />
    <audio/>
  </div>
</template>

<script setup lang="ts">

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { PauseCircleIcon, PlayCircleIcon, XCircleIcon } from 'lucide-vue-next'
import { onMounted, onBeforeUnmount, ref } from 'vue'
import Loader from '../components/Loader.vue'
import useAudioPlayer, { AudioStatus, textMaxLength } from '../utils/audio_player'
import { store } from '../services/store'

// init stuff
store.loadSettings()
const audioPlayer = useAudioPlayer(store.config)

const props = defineProps({
  extra: Object
})

const state = ref('idle')

let chunks: string[] = []
let index = 0

onMounted(async () => {
  //console.log('Processing query params', JSON.stringify(props.extra))
  audioPlayer.addListener(onAudioPlayerStatus)
  const text = window.api.automation.getText(props.extra.textId) 
  play(text)
})

onBeforeUnmount(() => {
  audioPlayer.removeListener(onAudioPlayerStatus)
})

const onAudioPlayerStatus = (status: AudioStatus) => {
  state.value = status.state
  console.log(state.value)
  if (state.value == 'idle') {
    if (!nextChunk()) {
      onClose()
    }
  }
}

const onPlayPause = () => {
  audioPlayer.playpause(`readaloud-${index}`)
}

const onStop = () => {
  audioPlayer.stop()
  onClose()
}

const onClose = () => {
  window.api.readaloud.closePalette(JSON.parse(props.extra?.sourceApp))
}

const play = async (message: string) => {

  // build chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    separators: [ '\n\n', '\n', '.', ',', ' '],
    keepSeparator: true,
    chunkSize: Math.floor(textMaxLength * .8),
    chunkOverlap: 0,
  })
  chunks = await textSplitter.splitText(message)

  // play first chunk
  playChunk(0)

}

const nextChunk = () => {
  if (index == chunks.length - 1) {
    return false
  } else {
    playChunk(index + 1)
    return true
  }
}

const playChunk = (i: number) => {
  index = i
  state.value = 'loading'
  const chunk = chunks[index]
  console.log(`Playing chunk ${index+1} of ${chunks.length}: [${chunk.length}] ${chunk.substring(0, 64)}...${chunk.substring(chunk.length-128)}`) 
  audioPlayer.play(document.querySelector('.readaloud audio'), `readaloud-${index}`, chunks[index])
}

</script>

<style scoped>

.readaloud {
  height: 100vh;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  background-color: var(--window-bg-color);
  color: var(--text-color);
  font-size: 24px;
  padding: 0px 8px;
  -webkit-app-region: drag;
}

.readaloud * {
  -webkit-app-region: no-drag;
}

.loader {
  margin-left: 8px;
  margin-right: 8px;
}

</style>