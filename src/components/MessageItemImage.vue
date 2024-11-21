<template>
  <div class="image-container">
    <img :src="url" :alt="desc" class="image" @click="onFullscreen" @load="onImageLoaded"/>
    <div class="image-actions">
      <BIconInfoCircle class="action info" v-if="prompt" @click="onInfo"/>
      <BIconDownload class="action download" @click="onDownload" />
    </div>
  </div>
</template>

<script setup lang="ts">

import Dialog from '../composables/dialog'
import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const props = defineProps({
  url: {
    type: String,
    required: true,
  },
  desc: String,
  prompt: String
})

const emits = defineEmits(['image-loaded'])

const onImageLoaded = () => {
  emits('image-loaded')
}

const onFullscreen = () => {
  emitEvent('fullscreen', props.url)
}

const onInfo = () => {
  Dialog.show({
    title: props.desc,
    text: props.prompt,
  })
}

const onDownload = () => {
  window.api.file.download({
    url: props.url,
    properties: {
      prompt: true,
      directory: 'downloads',
      filename: 'image.png',
    }
  })
}

</script>

<style scoped>

img {
  cursor: pointer;
}

</style>