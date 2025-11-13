<template>
  <div class="message" :class="[ message.role, message.type ]" @mouseenter="onHover(true)" @mouseleave="onHover(false)">
    
    <div class="role" :class="message.role" v-if="showRole" v-tooltip="{ text: modelInfo, anchor: '.name', position: 'below' }">
      <template v-if="agent">
        <AgentIcon class="avatar" />
        <div class="name variable-font-size">{{ agent.name }}</div>
      </template>
      <template v-else>
        <EngineLogo :engine="message.engine || chat.engine!" :grayscale="theme == 'dark'" class="avatar" v-if="message.role == 'assistant'" />
        <UserAvatar class="avatar" v-else />
        <div class="name variable-font-size">
          {{ authorName }}
          <span class="edited-indicator" v-if="message.role == 'assistant' && message.edited">{{ t('chat.edited') }}</span>
        </div>
      </template>
    </div>
    
    <div class="body" @contextmenu="onContextMenu">

      <!-- status -->
      <div class="status-container" v-if="message.status && message.transient">
        <SpinningIcon :icon="LoaderCircleIcon" :spinning="true" size="xl" class="icon" />
        <!-- <LoaderCircleIcon class="icon" /> -->
        <span class="status-text">{{ message.status }}</span>
      </div>


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

      <!-- content -->
      <div class="message-content" v-if="message.type == 'text' && message.content !== null">
        <div v-if="isEditing" class="edit-container form form-large">
          <textarea
            v-model="editedContent"
            class="edit-textarea"
            :placeholder="t('chat.editPlaceholder')"
            @keydown.meta.enter="saveEdit"
            @keydown.ctrl.enter="saveEdit"
            @keydown.escape="cancelEditing"
          ></textarea>
          <div class="edit-actions">
            <button @click="saveEdit" class="primary">{{ t('chat.send') }}</button>
            <button @click="cancelEditing" class="tertiary">{{ t('chat.cancel') }}</button>
          </div>
        </div>
        <MessageItemBody v-else :message="message" :show-tool-calls="showToolCalls" @media-loaded="onMediaLoaded" />
      </div>

      <!-- transient information -->
      <div v-if="message.transient" class="message-transient">
        <MessageItemToolBlock v-for="runningTool in runningTools" :tool-call="runningTool" v-if="runningTools" />
        <Loader v-if="!message.status" />
      </div>

    </div>
    <MessageItemActions :message="message" :read-aloud="onReadAloud" :audio-state="audioState" @show-tools="onShowTools" :class="{ visible: hovered }" v-if="!isEditing"/>
    <audio ref="audio" />
  </div>
</template>

<script setup lang="ts">

import { LoaderCircleIcon } from 'lucide-vue-next'
import { computed, onMounted, onBeforeUnmount, PropType, ref, watch } from 'vue'
import AgentIcon from '../../../assets/agent.svg?component'
import UserAvatar from '../../../assets/person.crop.circle.svg?component'
import useAppearanceTheme from '../composables/appearance_theme'
import useAudioPlayer, { AudioStatus } from '../utils/audio_player'
import Attachment from '../../models/attachment'
import Chat from '../../models/chat'
import Message from '../../models/message'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { ChatToolMode } from 'types/config'
import AttachmentView from './Attachment.vue'
import EngineLogo from './EngineLogo.vue'
import Loader from './Loader.vue'
import MessageItemActions from './MessageItemActions.vue'
import MessageItemBody from './MessageItemBody.vue'
import MessageItemMediaBlock from './MessageItemMediaBlock.vue'
import MessageItemToolBlock from './MessageItemToolBlock.vue'
import SpinningIcon from './SpinningIcon.vue'
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
const isEditing = ref(false)
const editedContent = ref('')

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

onBeforeUnmount(() => {
  if (updateLinkInterval) {
    clearInterval(updateLinkInterval)
  }
  audioPlayer.removeListener(onAudioPlayerStatus)
  // window.api.off('copy-as-markdown', onCopyMarkdown)
})

const agent = computed(() => {
  if (props.message.agentId) {
    const agent = store.agents.find(a => a.uuid === props.message.agentId)
    return agent
  }
  return null
})

const authorName = computed(() => {
  return props.message.role === 'assistant' ? t('chat.role.assistant') : t('chat.role.user')
})

const modelInfo = computed(() => {
  if (props.message.role === 'assistant') {
    if (props.message.engine && props.message.model) {
      return `${props.message.engine}/${props.message.model}`
    } else {
      return t('chat.unknownModel')
    }
  }
  return ''
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

const startEditing = () => {
  isEditing.value = true
  editedContent.value = props.message.content
}

const cancelEditing = () => {
  isEditing.value = false
  editedContent.value = ''
}

const saveEdit = () => {
  if (editedContent.value.trim() === '') {
    return
  }

  if (props.message.role === 'user') {
    // Emit event for resending
    emitEvent('resend-after-edit', {
      message: props.message,
      newContent: editedContent.value
    })
  } else {
    // For assistant messages, just update content
    props.message.updateContent(editedContent.value)
    store.saveHistory()
  }

  isEditing.value = false
  editedContent.value = ''
}

// Listen for edit events from MessageItemActions
onEvent('edit-message', (messageId: string) => {
  if (messageId === props.message.uuid) {
    startEditing()
  }
})

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

.role {
  * {
    font-family: var(--messages-font);
  }
}

.edited-indicator {
  margin-left: var(--space-4);
  font-size: var(--font-size-12);
  color: var(--color-on-surface-variant);
  font-style: italic;
}

.edit-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.edit-textarea {
  min-height: 6lh;
  resize: vertical;
  flex: 0 1 auto;
}

.edit-actions {
  flex-shrink: 0;
  display: flex;
  gap: var(--space-4);
  justify-content: flex-start;
  margin: 0;
}

.expert {
  margin-top: 0px;
  margin-bottom: -12px;
  p {
    margin-top: 0;
    display: inline-flex;
    align-items: center;
    font-weight: 600;
    font-size: 0.9em;
    gap: 0.25rem;
  }
}

img {
  cursor: pointer;
}

</style>