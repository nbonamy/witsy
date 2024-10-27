<template>
  <div class="message" :class="[ message.role, message.type ]" @mouseenter="onHover(true)" @mouseleave="onHover(false) ">
    <div class="role" :class="message.role" v-if="showRole">
      <EngineLogo :engine="chat.engine" :grayscale="theme == 'dark'" class="avatar" v-if="message.role == 'assistant'" />
      <img src="/assets/person.crop.circle.svg" class="avatar" v-else />
      <div class="name variable-font-size">{{ authorName }}</div>
    </div>
    <div class="body">

      <!-- attachment -->
      <div v-if="message.attachment">
        <Attachment :attachment="message.attachment" class="attachment" @image-click="onClickAttachment(message.attachment)" />
      </div>

      <!-- image for backwards compatibility -->
      <MessageItemImage :url="imageUrl" @image-loaded="onImageLoaded(message)" v-if="message.type == 'image'" />

      <!-- text -->
      <div v-if="message.type == 'text' && message.content !== null">
        <MessageItemBody :message="message" @image-loaded="onImageLoaded" />
      </div>

      <!-- transient information -->
      <div v-if="message.transient" class="transient">
        <Loader />
        <span v-if="message.toolCall" class="tool-call">{{ message.toolCall }}</span>
      </div>

    </div>
    <MessageItemActions :message="message" :read-aloud="onReadAloud" :audio-state="audioState" v-if="hovered" />
    <audio ref="audio" />
  </div>
</template>

<script setup>

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import useAudioPlayer from '../composables/audio_player'
import useAppearanceTheme from '../composables/appearance_theme'
import MessageItemBody from './MessageItemBody.vue'
import MessageItemImage from './MessageItemImage.vue'
import MessageItemActions from './MessageItemActions.vue'
import Chat from '../models/chat'
import Message from '../models/message'
import Loader from './Loader.vue'
import Attachment from './Attachment.vue'
import EngineLogo from './EngineLogo.vue'

// events
import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

// init stuff
const appearanceTheme = useAppearanceTheme()
const audioPlayer = useAudioPlayer(store.config)

const props = defineProps({
  chat: Chat,
  message: Object,
  showRole: { type: Boolean, default: true },
  showActions: { type: Boolean, default: true },
})

const emits = defineEmits(['image-loaded'])

const theme = ref('light')
const hovered = ref(false)
const audio = ref(null)
const audioState = ref({
  state: 'idle',
  messageId: null,
})

// onUpdated is not called for an unknown reason
// so let's hack it
let updateLinkInterval = null 
onMounted(() => {

  // make sure links are going outside
  updateLinkInterval = setInterval(() => {
    document.querySelectorAll('.messages a').forEach(link => {
      link.target = "_blank"
    })
  }, 599)

  // audio listener init
  audioPlayer.addListener(onAudioPlayerStatus)
  onEvent('audio-noise-detected', () =>  audioPlayer.stop)

  // dark mode stuff  
  theme.value = appearanceTheme.getTheme()
  onEvent('appearance-theme-change', (th) => {
    theme.value = th
  })
})

onUnmounted(() => {
  clearInterval(updateLinkInterval)
  audioPlayer.removeListener(onAudioPlayerStatus)
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

// using simple css :hover
// was not working from a testing perspective
// so we fallback to that...
const onHover = (value) => {
  if (props.showActions) {
    hovered.value = value
  }
}

const onClickAttachment = (attachment) => {
  emitEvent('fullscreen', attachment.url)
}

const onImageLoaded = (message) => {
  emits('image-loaded', message)
}

const onAudioPlayerStatus = (status) => {
  audioState.value = { state: status.state, messageId: status.uuid }
}

const onReadAloud = async (message) => {
  await audioPlayer.play(audio.value.$el, message.uuid, message.content)
}

defineExpose({
  readAloud: () => {
    onReadAloud(props.message)
  }
})

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

.name {
  font-family: var(--messages-font);
}

img {
  cursor: pointer;
}

.transient {
  display: flex;
  flex-direction: row;
  align-items: center;

  .tool-call {
    margin-left: 8px;
    font-size: 10.5pt;
    color: var(--message-list-tip-text-color);
  }
}

</style>