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

import { ref, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import useAudioPlayer from '../composables/audio'
import Loader from '../components/Loader.vue'

// load store
store.loadSettings()

const props = defineProps({
  extra: Object
})

const state = ref('idle')

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
    window.api.readaloud.closePalette()
  }
}

const onPlayPause = () => {
  useAudioPlayer().playpause('readaloud')
}

const onStop = () => {
  useAudioPlayer().stop()
  window.api.readaloud.closePalette()
}

const play = (message) => {
  useAudioPlayer().play(document.querySelector('.readaloud audio'), 'readaloud', message)
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