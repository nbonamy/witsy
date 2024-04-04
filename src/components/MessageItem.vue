<template>
  <div class="message" :class="message.role" v-if="message.role != 'system'">
    <div class="role" :class="message.role">
      <div class="avatar">{{ authorAvatar }}</div>
      <div class="name">{{ authorName }}</div>
    </div>
    <div class="body">
      <div v-if="message.type == 'text'">
        <Loader v-if="message.content === null" class="text" />
        <vue-markdown v-else class="text" :source="message.content" :options="mdOptions" />
      </div>
      <div v-if="message.type == 'image'" class="image-container">
        <img :src="imageUrl" class="image" />
        <BIconDownload class="download" @click="onDownload(message)" />
      </div>
    </div>
  </div>
</template>

<script setup>

import { ipcRenderer } from 'electron'
import { computed } from 'vue'
import Message from '../models/message.js'
import Loader from './Loader.vue'
import VueMarkdown from 'vue-markdown-render'
import hljs from 'highlight.js'

const props = defineProps({
  message: Message
})

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
@import '../../css/themes/base.css';
@import '../../css/themes/openai.css';
@import '../../css/themes/conversation.css';
@import '../../css/highlight.css';
</style>
