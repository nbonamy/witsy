<template>
  <div class="message" :class="message.role" v-if="message.role != 'system'">
    <div class="role" :class="message.role">
      <div class="avatar">{{ authorAvatar }}</div>
      <div class="name">{{ authorName }}</div>
    </div>
    <div class="body">
      <div v-if="message.type == 'text'">
        <vue-markdown v-if="message.content !== null" class="text" :source="message.content" :options="mdOptions" />
        <Loader v-if="message.transient" />
      </div>
      <div v-if="message.type == 'image'" class="image-container">
        <img :src="imageUrl" class="image" @click="onFullscreen(imageUrl)"/>
        <BIconDownload class="download" @click="onDownload(message)" />
      </div>
    </div>
    <div class="fullscreen" v-if="fullScreenImageUrl" @click="onCloseFullscreen">
      <img :src="fullScreenImageUrl"/>
      <BIconXLg class="close" />
    </div>
  </div>
</template>

<script setup>

import { ipcRenderer } from 'electron'
import { ref, computed } from 'vue'
import Message from '../models/message.js'
import Loader from './Loader.vue'
import VueMarkdown from 'vue-markdown-render'
import hljs from 'highlight.js'

const props = defineProps({
  message: Message
})

const fullScreenImageUrl = ref(null)

const authorAvatar = computed(() => {
  return props.message.role === 'assistant' ? '🤖' : '👤'
})

const authorName = computed(() => {
  return props.message.role === 'assistant' ? 'Assistant' : 'You'
})

const imageUrl = computed(() => {
  if (props.message.type !== 'image' || typeof props.message.content !== 'string') {
    return null
  } else if (props.message.content.startsWith('http')) {
    return props.message.content
  } else if (props.message.content.startsWith('file://')) {
    //TODO: custom protocol to re-enable websecurity
    return props.message.content.replace('file://', 'file://')
  } else {
    return 'data:image/png;base64,' + props.message.content
  }
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

const onFullscreen = (url) => {
  fullScreenImageUrl.value = url
  ipcRenderer.send('fullscreen', true)
}

const onCloseFullscreen = () => {
  fullScreenImageUrl.value = null
  ipcRenderer.send('fullscreen', false)
}

const onDownload = (message) => {
  ipcRenderer.send('download', {
    url: message.content,
    properties: {
      filename: 'image.png',
    }
  })
}

</script>

<style>
@import '../../css/highlight.css';
@import '../../css/themes/base.css';
@import '../../css/themes/openai.css';
@import '../../css/themes/conversation.css';
</style>

<style scoped>

.message .body img {
  cursor: pointer;
}

.fullscreen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: black;
  padding: 8px;
  z-index: 1000;
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
  font-size: 14pt;
}

</style>