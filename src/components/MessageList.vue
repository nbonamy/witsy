<template>
  <div class="messages">
    <div v-for="message in messages" :key="message.createdAt" class="message" :class="message.role">
      <div v-if="message.role != 'system'" class="body">
        <vue-markdown v-if="message.type == 'text'" class="text" :source="message.content || '...'" :options="mdOptions" />
        <img  v-if="message.type == 'image'" :src="message.content" class="image" @click="onDownload(message)"/>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ipcRenderer } from 'electron'
import VueMarkdown from 'vue-markdown-render'
import hljs from 'highlight.js'

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
  width: 75%;
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

</style>
