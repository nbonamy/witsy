<template>
  <div class="readaloud">
    <BIconPauseCircle v-if="state == 'playing'" @click="onPlayPause()" />
    <BIconPlayCircle v-else-if="state == 'paused'" @click="onPlayPause()" />
    <Loader class="loader" v-else />
    <BIconXCircle @click="onStop()" />
    <audio/>
  </div>
</template>

<script setup>

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { ref, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import useAudioPlayer, { textMaxLength} from '../composables/audio'
import Loader from '../components/Loader.vue'

// load store
store.loadSettings()

const props = defineProps({
  extra: Object
})

const state = ref('idle')

let chunks = []
let index = 0

onMounted(async () => {
  useAudioPlayer().addListener(onAudioPlayerStatus)
  const text = window.api.readaloud.getText(props.extra.textId) 
  play(text)
})

onUnmounted(() => {
  useAudioPlayer().removeListener(onAudioPlayerStatus)
})

const onAudioPlayerStatus = (status) => {
  state.value = status.state
  console.log(state.value)
  if (state.value == 'idle') {
    if (!nextChunk()) {
      window.api.readaloud.closePalette()
    }
  }
}

const onPlayPause = () => {
  useAudioPlayer().playpause(`readaloud-${index}`)
}

const onStop = () => {
  useAudioPlayer().stop()
  window.api.readaloud.closePalette()
}

const play = async (message) => {

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

const playChunk = (i) => {
  index = i
  state.value = 'loading'
  const chunk = chunks[index]
  console.log(`Playing chunk ${index+1} of ${chunks.length}: [${chunk.length}] ${chunk.substring(0, 64)}...${chunk.substring(chunk.length-128)}`) 
  useAudioPlayer().play(document.querySelector('.readaloud audio'), `readaloud-${index}`, chunks[index])
}

</script>

<style scoped>

.readaloud {
  height: 100vh;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  background-color: #e7e6e5;
  font-size: 18pt;
  padding: 0px 8px;
}

.loader {
  margin-left: 8px;
  margin-right: 8px;
}

</style>