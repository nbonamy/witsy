<template>
  <div class="fullscreen" :class="fullScreenTheme" v-if="fullScreenImageUrl" @click="onCloseFullScreen">
    <img :src="fullScreenImageUrl" alt="Full screen image" />
    <XIcon class="close" @click.stop="onCloseFullScreen" />
  </div>
</template>

<script setup lang="ts">

import { strDict } from '../types/index'
import { ref, onMounted } from 'vue'

import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const props = defineProps({
  window: {
    type: String,
    required: true,
  }
})

const fullScreenImageUrl = ref<string|null>(null)
const fullScreenTheme = ref<string|null>(null)

onMounted(() => {
  onEvent('fullscreen', onFullscreen)
})

const onFullscreen = (payload: string|strDict) => {
  document.addEventListener('keydown', onCloseFullScreen)
  // @ts-expect-error yeah that's not super elegant
  fullScreenImageUrl.value = payload.url ?? payload
  // @ts-expect-error yeah that's not super elegant
  fullScreenTheme.value = payload.theme
  window.api.app.fullscreen(props.window, true)
}

const onCloseFullScreen = () => {
  document.removeEventListener('keydown', onCloseFullScreen)
  fullScreenImageUrl.value = null
  window.api.app.fullscreen(props.window, false)
}

</script>

<style scoped>

.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: black;
  padding: 8px;
  z-index: 100;
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.fullscreen img {
  height: 100%;
  width: 100%;
  object-fit: contain;
}

.fullscreen .close {
  color: white;
  position: absolute;
  top: 16px;
  right: 16px;
  font-size: 18.5px;
}

.fullscreen.light {
  background-color: white;
}

</style>
