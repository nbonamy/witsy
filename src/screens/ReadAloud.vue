<template>
  <div class="readaloud">
    <BIconPauseCircle v-if="state == 'playing'" @click="onPlayPause()" />
    <BIconPlayCircle v-else-if="state == 'paused'" @click="onPlayPause()" />
    <Loader class="loader" v-else />
    <BIconXCircle @click="onStop()" />
    <audio/>
  </div>
</template>

<script setup lang="ts">

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { ref, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import useAudioPlayer, { AudioStatus, textMaxLength} from '../composables/audio_player'
import Loader from '../components/Loader.vue'

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
  audioPlayer.addListener(onAudioPlayerStatus)
  const text = window.api.automation.getText(props.extra.textId) 
  play(text)
})

onUnmounted(() => {
  audioPlayer.removeListener(onAudioPlayerStatus)
})

const onAudioPlayerStatus = (status: AudioStatus) => {
  state.value = status.state
  console.log(state.value)
  if (state.value == 'idle') {
    if (!nextChunk()) {
      window.api.readaloud.closePalette()
    }
  }
}

const onPlayPause = () => {
  audioPlayer.playpause(`readaloud-${index}`)
}

const onStop = () => {
  audioPlayer.stop()
  window.api.readaloud.closePalette()
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
  font-size: 18pt;
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