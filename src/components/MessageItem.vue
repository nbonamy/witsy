<template>
  <div class="message" :class="[ message.role, message.type ]" @mouseenter="onHover(true)" @mouseleave="onHover(false) ">
    <div class="role" :class="message.role" v-if="showRole">
      <EngineLogo :engine="message.engine || chat.engine!" :grayscale="theme == 'dark'" class="avatar" v-if="message.role == 'assistant'" />
      <UserAvatar class="avatar" v-else />
      <div class="name variable-font-size">{{ authorName }}</div>
    </div>
    <div class="body">

      <!-- attachments -->
      <div class="attachments">
        <AttachmentView v-for="attachment in message.attachments"
          :attachment="attachment" class="attachment" @image-click="onClickAttachment(attachment)"
          />
      </div>

      <!-- image for backwards compatibility -->
      <MessageItemMediaBlock :url="imageUrl" @media-loaded="onMediaLoaded(message)" v-if="message.type == 'image' && imageUrl" />

      <!-- expert -->
       <div v-if="message.expert" class="expert text variable-font-size">
        <p><BIconStars/> {{  message.expert.name }}</p>
      </div>

      <!-- content -->
      <div class="message-content" v-if="message.type == 'text' && message.content !== null">
        <MessageItemBody :message="message" :show-tool-calls="showToolCalls" @media-loaded="onMediaLoaded" />
      </div>

      <!-- transient information -->
      <div v-if="message.transient" class="message-transient">
        <MessageItemToolBlock :tool-call="runningTool" v-if="runningTool" />
        <Loader v-else />
      </div>

    </div>
    <MessageItemActions :message="message" :read-aloud="onReadAloud" :audio-state="audioState" @show-tools="onShowTools" v-if="hovered" />
    <audio ref="audio" />
  </div>
</template>

<script setup lang="ts">

import { ChatToolMode } from '../types/config'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import useAudioPlayer, { AudioStatus } from '../composables/audio_player'
import useAppearanceTheme from '../composables/appearance_theme'
import UserAvatar from '../../assets/person.crop.circle.svg?component'
import MessageItemBody from './MessageItemBody.vue'
import MessageItemMediaBlock from './MessageItemMediaBlock.vue'
import MessageItemToolBlock from './MessageItemToolBlock.vue'
import MessageItemActions from './MessageItemActions.vue'
import Chat from '../models/chat'
import Attachment from '../models/attachment'
import Message from '../models/message'
import Loader from './Loader.vue'
import AttachmentView from './Attachment.vue'
import EngineLogo from './EngineLogo.vue'

// events
import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

// init stuff
const appearanceTheme = useAppearanceTheme()
const audioPlayer = useAudioPlayer(store.config)

const props = defineProps({
  chat: {
    type: Chat,
    // required: true,
  },
  message: {
    type: Message,
    required: true,
  },
  showRole: { type: Boolean, default: true },
  showActions: { type: Boolean, default: true },
})

const emits = defineEmits(['media-loaded'])

const theme = ref('light')
const hovered = ref(false)
const audio = ref<HTMLAudioElement|null>(null)
const showToolCalls = ref<ChatToolMode>(store.config.appearance.chat.showToolCalls)
const audioState = ref<{state: string, messageId: string|null}>({
  state: 'idle',
  messageId: null,
})

// onUpdated is not called for an unknown reason
// so let's hack it
let updateLinkInterval: NodeJS.Timeout|null = null 
onMounted(() => {

  // make sure links are going outside
  updateLinkInterval = setInterval(() => {
    document.querySelectorAll<HTMLLinkElement>('.messages a').forEach(link => {
      link.target = "_blank"
    })
  }, 500)

  // audio listener init
  audioPlayer.addListener(onAudioPlayerStatus)
  onEvent('audio-noise-detected', () =>  audioPlayer.stop)

  // dark mode stuff  
  theme.value = appearanceTheme.getTheme()
  onEvent('appearance-theme-change', (th: string) => {
    theme.value = th
  })

  // settings change
  watch(() => store.config.appearance.chat.showToolCalls, (value) => {
    showToolCalls.value = value
  })

})

onUnmounted(() => {
  if (updateLinkInterval) {
    clearInterval(updateLinkInterval)
  }
  audioPlayer.removeListener(onAudioPlayerStatus)
})

const authorName = computed(() => {
  return props.message.role === 'assistant' ? t('chat.role.assistant') : t('chat.role.user')
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

const runningTool = computed(() => {
  if (store.config.appearance.chat.showToolCalls === 'never') return null
  if (props.message.toolCalls.length === 0) return null
  const lastToolCall = props.message.toolCalls[props.message.toolCalls.length - 1]
  return lastToolCall.done ? null : lastToolCall
})

// using simple css :hover
// was not working from a testing perspective
// so we fallback to that...
const onHover = (value: boolean) => {
  if (props.showActions) {
    hovered.value = value
  }
}

const onClickAttachment = (attachment: Attachment) => {
  emitEvent('fullscreen', attachment.url)
}

const onMediaLoaded = (message: Message) => {
  emits('media-loaded', message)
}

const onAudioPlayerStatus = (status: AudioStatus) => {
  audioState.value = { state: status.state, messageId: status.uuid }
}

const onReadAloud = async (message: Message) => {
  await audioPlayer.play(audio.value!, message.uuid, message.content)
}

const onShowTools = () => {
  if (showToolCalls.value !== 'always') {
    showToolCalls.value = 'always'
  } else {
    showToolCalls.value = 'never'
  }
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

.message .body .katex-mathml {
  font-family: 'STIX Two Math';
}

.message .body .katex-html {
  display: none;
}

</style>

<style scoped>

.name {
  font-family: var(--messages-font);
}

.expert {
  margin-top: 12px;
  margin-bottom: -12px;
}

img {
  cursor: pointer;
}

</style>