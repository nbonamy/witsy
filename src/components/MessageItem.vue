<template>
  <div class="message" :class="[ message.role, message.type ]" @mouseenter="onHover(true)" @mouseleave="onHover(false)">
    <div class="role" :class="message.role" v-if="showRole">
      <EngineLogo :engine="message.engine || chat.engine!" :grayscale="theme == 'dark'" class="avatar" v-if="message.role == 'assistant'" />
      <UserAvatar class="avatar" v-else />
      <div class="name variable-font-size">{{ authorName }}</div>
    </div>
    <div class="body" @contextmenu="onContextMenu">

      <!-- attachments -->
      <div class="attachments">
        <AttachmentView v-for="attachment in message.attachments"
          :attachment="attachment" class="attachment"
          @click="onClickAttachment(attachment)"
          @image-click="onClickImageAttachment(attachment)"
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
        <MessageItemToolBlock v-for="runningTool in runningTools" :tool-call="runningTool" v-if="runningTools" />
        <Loader v-else />
      </div>

    </div>
    <MessageItemActions :message="message" :read-aloud="onReadAloud" :audio-state="audioState" @show-tools="onShowTools" v-if="hovered" />
    <audio ref="audio" />
  </div>
</template>

<script setup lang="ts">

import { ChatToolMode } from '../types/config'
import { ref, computed, onMounted, onUnmounted, PropType, watch } from 'vue'
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
// import { getMarkdownSelection } from '../services/markdown'

// events
import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

// init stuff
const appearanceTheme = useAppearanceTheme()
const audioPlayer = useAudioPlayer(store.config)

const props = defineProps({
  chat: {
    type: Object as PropType<Chat>,
    // required: true,
  },
  message: {
    type: Object as PropType<Message>,
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

  // selection related context menu stuff 
  // window.api.on('copy-as-markdown', onCopyMarkdown)
  
})

onUnmounted(() => {
  if (updateLinkInterval) {
    clearInterval(updateLinkInterval)
  }
  audioPlayer.removeListener(onAudioPlayerStatus)
  // window.api.off('copy-as-markdown', onCopyMarkdown)
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

const runningTools = computed(() => {
  if (store.config.appearance.chat.showToolCalls === 'never') return null
  const runningTools = props.message.toolCalls.filter(toolCall => !toolCall.done)
  return runningTools.length ? runningTools : null
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
  if (props.message.role === 'assistant') {
    window.api.file.download({
      url: attachment.url,
      properties: {
        prompt: true,
        directory: 'downloads',
        filename: attachment.title,
      }
    })
  }
}

const onClickImageAttachment = (attachment: Attachment) => {
  emitEvent('fullscreen', attachment.url)
}

const onMediaLoaded = (message: Message) => {
  emits('media-loaded', message)
}

const onAudioPlayerStatus = (status: AudioStatus) => {
  audioState.value = { state: status.state, messageId: status.uuid }
}

const onCopyMarkdown = (payload: { context: string, selection: string }) => {
  // if (payload.context === props.message.uuid) {
  //   const selected = getMarkdownSelection(props.message.content)
  //   console.log('selected', selected)
  // }
}

const onReadAloud = async (message: Message) => {
  await audioPlayer.play(audio.value!, message.uuid, message.content)
}

const readAloudText = async (text: string) => {
  await audioPlayer.play(audio.value!, props.message.uuid, text)
}

const onShowTools = () => {
  if (showToolCalls.value !== 'always') {
    showToolCalls.value = 'always'
  } else {
    showToolCalls.value = 'never'
  }
}

const onContextMenu = (event: MouseEvent) => {
  window.api.main.setContextMenuContext(props.message.uuid)
}

defineExpose({
  message: props.message,
  readAloud: (text?: string) => {
    if (text) {
      readAloudText(text)
    } else {  
      onReadAloud(props.message)
    }
  }
})

</script>

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