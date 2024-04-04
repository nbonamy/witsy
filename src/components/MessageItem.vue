<template>
  <div class="message" :class="message.role">
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
</template>

<script setup>

import { ipcRenderer } from 'electron'
import Message from '../models/message.js'
import Loader from './Loader.vue'
import VueMarkdown from 'vue-markdown-render'
import hljs from 'highlight.js'

defineProps({
  message: Message
})

const mdOptions = {
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        let code = '<pre class="hljs"><code class="hljs">';
        code += hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        code += '</code></pre>';
        code += '<a href="#" onclick="navigator.clipboard.writeText(decodeURIComponent(\'' + encodeURIComponent(str) + '\'))" class="copy">Copy code</a>';
        return code;
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

.message img {
  background-image: url(https://storage.googleapis.com/proudcity/mebanenc/uploads/2021/03/placeholder-image.png);
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
