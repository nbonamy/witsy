<template>
  <div class="messages" ref="divMessages">
    <div v-for="message in messages" :key="message.uuid" class="message" :class="message.role">
      <div v-if="message.role != 'system'" class="body">
        <div v-if="message.type == 'text'">
          <Loader v-if="message.content === null" class="text" />
          <vue-markdown v-else class="text" :source="message.content" :options="mdOptions" />
        </div>
        <div v-if="message.type == 'image'" class="image-container">
          <img :src="message.content" class="image" />
          <BIconDownload class="download" @click="onDownload(message)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ipcRenderer } from 'electron'
import { ref, onMounted, nextTick } from 'vue'
import Loader from './Loader.vue'
import VueMarkdown from 'vue-markdown-render'
import hljs from 'highlight.js'

import useEventBus from '../composables/useEventBus'
const { onEvent } = useEventBus()

const divMessages = ref(null)

defineProps({
  messages: Array
})

const mdOptions = {
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    return '' // use external default escaping
  }
}

onMounted(() => {
  onEvent('newChunk', onNewChunk)
})

const onNewChunk = () => {
  nextTick(() => {
    divMessages.value.scrollTop = divMessages.value.scrollHeight
  })
}

const onDownload = (message) => {
  ipcRenderer.send('download', {
    payload: {
      url: message.content,
      properties: {
        filename: 'image.png',
      }
    }
  })
}

</script>

<style>
@import '../../css/highlight.css';
</style>

<style scoped>

.messages {
  height: 100vh;
  padding: 16px;
  overflow-y: auto;
}

.message {
  margin-bottom: 24px;
  display: flex;
}

.message .body {
  max-width: 66%;
  border-radius: 12px;
  padding: 0px 16px;
}

.message .text {
  user-select: text;
  font-size: 11pt;
}

.message .image {
  width: 100%;
  max-width: 400px;
  margin-top: 16px;
  border-radius: 8px;
}

.message.user {
  justify-content: flex-end;
}

.message.user .body {
  background-color: #2993f3;
  color: white;
}

.message.assistant .body {
  background-color: #e9e9eb;
  color: black;
}

.message .body:has(.image) {
  padding: 0px;
  background-color: transparent;
}

.message .image-container {
  position: relative;
  width: 75%;
}

.message .download {
  display: none;
  position: absolute;
  background-color: rgba(0, 0, 0, 0.66);
  top: 24px;
  right: 12px;
  cursor: pointer;
  font-size: 10pt;
  padding: 8px;
  border-radius: 8px;
  color: white;
}

.message .image-container:hover .download {
  display: block;
}

</style>
