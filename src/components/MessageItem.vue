<template>
  <div class="message" :class="[ message.role, message.type ]" v-if="message.role != 'system'">
    <div class="role" :class="message.role">
      <EngineLogo :engine="chat.engine" class="avatar" v-if="message.role == 'assistant'" />
      <img src="/assets/person.crop.circle.svg" class="avatar" v-else />
      <div class="name">{{ authorName }}</div>
    </div>
    <div class="body" :class="'size' + store.config.appearance.chat.fontSize">

      <!-- attachment -->
      <div v-if="message.attachment">
        <img :src="attachmentUrl" class="attachment" @click="onFullscreen(attachmentUrl)"/>
      </div>

      <!-- image -->
      <div v-if="message.type == 'image'" class="image-container">
        <img :src="imageUrl" class="image" @click="onFullscreen(imageUrl)" @load="onImageLoaded(message)"/>
        <BIconDownload class="download" @click="onDownload(message)" />
      </div>

      <!-- text -->
      <div v-if="message.type == 'text'">
        <vue-markdown v-if="message.content !== null" class="text" :source="mdPreprocess(message.content)" :options="mdOptions" :plugins="mdPlugins"/>
      </div>

      <!-- transient information -->
      <div v-if="message.transient" class="transient">
        <Loader />
        <span v-if="message.toolCall" class="tool-call">{{ message.toolCall }}</span>
      </div>

    </div>
    <div class="actions">
      <div class="action" v-if="message.role == 'assistant' && !message.transient" @click="onCopy(message)">
        <BIconClipboard /> {{ copyLabel }}
      </div>
      <div class="action read" v-if="message.role == 'assistant' && message.type == 'text' && !message.transient" @click="onToggleRead(message)">
        <span v-if="mgsAudioState(message) == 'playing'"><BIconStopCircle/> Stop</span>
        <span v-else-if="mgsAudioState(message) == 'loading'"><BIconXCircle/> Cancel</span>
        <span v-else><BIconPlayCircle /> Read</span>
        <audio/>
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

import { SpeechPlayer } from 'openai-speech-stream-player'
import { ipcRenderer, clipboard, nativeImage } from 'electron'
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { store } from '../services/store'
import Tts from '../services/tts'
import Chat from '../models/chat'
import Message from '../models/message'
import Loader from './Loader.vue'
import EngineLogo from './EngineLogo.vue'
import VueMarkdown from 'vue-markdown-render'
import MarkdownItKatex from '@iktakahiro/markdown-it-katex'
import hljs from 'highlight.js'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat,
  message: Message
})

const emits = defineEmits(['image-loaded'])

const fullScreenImageUrl = ref(null)
const copyLabel = ref('Copy')
const audioState = ref({
  state: 'idle',
  message: null,
})

// onUpdated is not called for an unknown reason
// so let's hack it
let updateLinkInterval = null 
onMounted(() => {
  updateLinkInterval = setInterval(() => {
    document.querySelectorAll('.messages a').forEach(link => {
      link.target = "_blank"
    })
  }, 599)
})
onUnmounted(() => {
  clearInterval(updateLinkInterval)
})

const mgsAudioState = (message) => {
  return message == audioState.value.message ? audioState.value.state : 'idle'
}

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

const onImageLoaded = (message) => {
  emits('image-loaded', message)
}

const onCopy = (message) => {
  if (message.type == 'text') {
    clipboard.writeText(message.content)
  } else if (message.type == 'image') {
    let image = nativeImage.createFromPath(props.message.content.replace('file://', ''))
    clipboard.writeImage(image)
  }
  copyLabel.value = 'Copied!'
  setTimeout(() => copyLabel.value = 'Copy', 1000)
}

let player = null
const onToggleRead = async (message) => {
  
  // if same message is playing, stop
  if (message == audioState.value.message && audioState.value.state != 'idle') {
    stopAudio()
    return
  }

  // if not same message 1st thing is to stop
  if (audioState.value.state != 'idle' && message != audioState.value.message) {
    stopAudio()
  }

  // set status
  audioState.value = {
    state: 'loading',
    message: message,
  }

  // give it a chance to appear
  nextTick(async () => {
      
    try {
  
      // get the stream
      const tts = new Tts(store.config)
      const response = await tts.synthetize(message.content)

      // stream it
      const audioEl = document.querySelector('.read audio')
      player = new SpeechPlayer({
        audio: audioEl,
        onPlaying: () => {
          audioState.value = {
            state: 'playing',
            message: message,
          }
        },
        onPause: () => {},
        onChunkEnd: () => {
          stopAudio()
        },
        mimeType: 'audio/mpeg',
      })
      await player.init()
      player.feedWithResponse(response.content)

    } catch (e) {
      console.error(e)
    }

  })

}

const stopAudio = () => {
  try {
    player?.pause()
    player?.destroy()
  } catch (e) {
    //console.error(e)
  }
  player = null
  audioState.value = {
    state: 'idle',
    message: null,
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

const mdPreprocess = (content) => {
  // for katex processing, we need to replace \[ and \] with $$ to trigger processing
  // until https://github.com/iktakahiro/markdown-it-katex/pull/13 is merged
  return content.replaceAll('\\[', '$$$$').replaceAll('\\]', '$$$$')
}

const mdOptions = {
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        let code = '<pre class="hljs"><code class="hljs">';
        code += hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        code += '</code></pre>';
        code += '<p><a href="#" onclick="navigator.clipboard.writeText(Buffer.from(\'' + Buffer.from(str).toString('base64') + '\', \'base64\').toString());';
        code += 'this.innerHTML = \'Copied!\'; setTimeout(() => this.innerHTML = \'Copy code\', 1000)" class="copy">Copy code</a></p>';
        return code;
      } catch (__) {}
    }
    return '' // use external default escaping
  }
}

const mdPlugins = [MarkdownItKatex]

</script>

<style>
@import '../../css/highlight.css';
@import '../../css/themes/base.css';
@import '../../css/themes/openai.css';
@import '../../css/themes/conversation.css';
</style>

<style>
.message .body .katex-html {
  display: none;
}
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

.actions {

  .action {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-left: 8px;

    &:first-child {
      margin-left: 0px;
    }

    svg {
      margin-right: 4px;
    }

    &.read svg {
      position: relative;
      top: 1.5px;
    }
  }

}

.transient {
  display: flex;
  flex-direction: row;
  align-items: center;

  .tool-call {
    margin-left: 8px;
    font-size: 10.5pt;
    color: #888;
  }
}

</style>