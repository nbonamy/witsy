<template>
  <div class="message" :class="[ message.role, message.type ]" v-if="message.role != 'system'">
    <div class="role" :class="message.role">
      <EngineLogo :engine="chat.engine" class="avatar" v-if="message.role == 'assistant'" />
      <img src="/assets/person.crop.circle.svg" class="avatar" v-else />
      <div class="name">{{ authorName }}</div>
    </div>
    <div class="body" :class="'size' + store.config.appearance.chat.fontSize">
      <div v-if="message.attachment">
        <img :src="attachmentUrl" class="attachment" @click="onFullscreen(attachmentUrl)"/>
      </div>
      <div v-if="message.type == 'text'">
        <vue-markdown v-if="message.content !== null" class="text" :source="message.content" :options="mdOptions" />
        <Loader v-if="message.transient" />
      </div>
      <div v-if="message.type == 'image'" class="image-container">
        <img :src="imageUrl" class="image" @click="onFullscreen(imageUrl)"/>
        <BIconDownload class="download" @click="onDownload(message)" />
      </div>
    </div>
    <div class="actions">
      <div class="action" v-if="message.role == 'assistant' && !message.transient" @click="onCopy(message)">
        <BIconClipboard /> Copy
      </div>
      <div class="action" v-if="message.role == 'user' && message.type == 'text' && !message.transient" @click="onEdit(message)">
        <BIconPencil /> Edit
      </div>
    </div>
    <div class="fullscreen" v-if="fullScreenImageUrl" @click="onCloseFullscreen">
      <img :src="fullScreenImageUrl"/>
      <BIconXLg class="close" />
    </div>
  </div>
</template>

<script setup>

import { ipcRenderer, clipboard, nativeImage } from 'electron'
import { ref, computed } from 'vue'
import { store } from '../services/store'
import Chat from '../models/chat.js'
import Message from '../models/message.js'
import Loader from './Loader.vue'
import EngineLogo from './EngineLogo.vue'
import VueMarkdown from 'vue-markdown-render'
import hljs from 'highlight.js'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat,
  message: Message
})

const fullScreenImageUrl = ref(null)

const authorName = computed(() => {
  return props.message.role === 'assistant' ? 'Assistant' : 'You'
})

const attachmentUrl = computed(() => {
  if (props.message.attachment?.contents) {
    return 'data:image/png;base64,' + props.message.attachment.contents
  } else {
    return props.message.attachment?.url
  }
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
        code += '<a href="#" onclick="navigator.clipboard.writeText(Buffer.from(\'' + Buffer.from(str).toString('base64') + '\', \'base64\').toString())" class="copy">Copy code</a>';
        return code;
      } catch (__) {}
    }
    return '' // use external default escaping
  }
}

const onCopy = (message) => {
  if (message.type == 'text') {
    clipboard.writeText(message.content)
  } else if (message.type == 'image') {
    let image = nativeImage.createFromPath(props.message.content.replace('file://', ''))
    clipboard.writeImage(image)
  }
}

const onEdit = (message) => {
  emitEvent('set-prompt', message)
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