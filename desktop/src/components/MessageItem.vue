<template>
  <div class="message" :class="[ message.role, message.type ]" @mouseenter="onHover(true)" @mouseleave="onHover(false) ">
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
        <div v-if="message.content !== null" v-html="mdRender(message.content)" class="text"></div>
      </div>

      <!-- transient information -->
      <div v-if="message.transient" class="transient">
        <Loader />
        <span v-if="message.toolCall" class="tool-call">{{ message.toolCall }}</span>
      </div>

    </div>
    <div class="actions" v-if="hovered">
      <div class="action copy" v-if="message.role == 'assistant' && !message.transient" @click="onCopy(message)">
        <BIconClipboard /> {{ copyLabel }}
      </div>
      <div class="action read" v-if="message.role == 'assistant' && message.type == 'text' && !message.transient" @click="onToggleRead(message)">
        <span v-if="mgsAudioState(message) == 'playing'"><BIconStopCircle/> Stop</span>
        <span v-else-if="mgsAudioState(message) == 'loading'"><BIconXCircle/> Cancel</span>
        <span v-else><BIconPlayCircle /> Read</span>
        <audio/>
      </div>
      <div class="action edit" v-if="message.role == 'user' && message.type == 'text' && !message.transient" @click="onEdit(message)">
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

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import useAudioPlayer from '../composables/audio'
import Chat from '../models/chat'
import Message from '../models/message'
import Loader from './Loader.vue'
import EngineLogo from './EngineLogo.vue'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat,
  message: Message
})

const emits = defineEmits(['image-loaded'])

const hovered = ref(false)
const fullScreenImageUrl = ref(null)
const copyLabel = ref('Copy')
const audioState = ref({
  state: 'idle',
  messageId: null,
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
  useAudioPlayer().addListener(onAudioPlayerStatus)
})
onUnmounted(() => {
  clearInterval(updateLinkInterval)
  useAudioPlayer().removeListener(onAudioPlayerStatus)
})

const mgsAudioState = (message) => {
  return message.uuid == audioState.value.messageId ? audioState.value.state : 'idle'
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

// using simple css :hover
// was not working from a testing perspective
// so we fallback to that...
const onHover = (value) => {
  hovered.value = value
}

const onImageLoaded = (message) => {
  emits('image-loaded', message)
}

const onCopy = (message) => {
  if (message.type == 'text') {
    window.api.clipboard.writeText(message.content)
  } else if (message.type == 'image') {
    window.api.clipboard.writeImage(message.content)
  }
  copyLabel.value = 'Copied!'
  setTimeout(() => copyLabel.value = 'Copy', 1000)
}

const onAudioPlayerStatus = (status) => {
  audioState.value = { state: status.state, messageId: status.uuid }
}

const onToggleRead = async (message) => {
  await useAudioPlayer().play(document.querySelector('.read audio'),message.uuid, message.content)
}

const onEdit = (message) => {
  emitEvent('set-prompt', message)
}

const onFullscreen = (url) => {
  fullScreenImageUrl.value = url
  window.api.fullscreen(true)
}

const onCloseFullscreen = () => {
  fullScreenImageUrl.value = null
  window.api.fullscreen(false)
}

const onDownload = (message) => {
  window.api.file.download({
    url: message.content,
    properties: {
      filename: 'image.png',
    }
  })
}

const mdRender = (content) => {
  return window.api.markdown.render(content)
}

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