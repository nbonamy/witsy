<template>
  <div class="response messages openai size4" @mousedown.stop="onMouseDown">
    <MessageItem :message="message" :show-role="false" :show-actions="false" />
    <div class="actions">
      <MessageItemActionCopy :message="message" ref="actionCopy" />
      <div class="action replace" v-if="!isMas && showReplace && !message.transient" @click="onReplace">
        <BIconArrowLeftRight /> {{ t('common.replace') }}
      </div>
      <div class="action insert" v-if="!isMas && !message.transient" @click="onInsert">
        <BIconArrowReturnLeft /> {{ t('common.insert') }}
      </div>
      <MessageItemActionRead :message="message" :audio-state="audioState" :read-aloud="onReadAloud" />
      <div class="action continue" v-if="!message.transient" @click="onChat">
        <BIconChatSquare /> {{ t('common.chat') }}
      </div>
      <div class="action scratchpad" v-if="!message.transient" @click="onScratchPad">
        <BIconPen /> {{ t('common.write') }}
      </div>
      <div class="action retry" v-if="!message.transient" @click="onRetry(message)">
        <BIconArrowCounterclockwise /> {{ t('common.retry') }}
      </div>
      <div class="action spacer" />
      <div class="action clear" @click="onClear" v-if="showClear">
        <BIconXCircle /> {{ t('common.clear') }}
      </div>
      <div class="action close" @click="onClose">
        <span class="narrow">{{ t('common.esc') }}</span> {{ t('common.close') }}
      </div>
    </div>
  </div>
  <audio ref="audio" />
</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted, PropType } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import useAudioPlayer, { AudioStatus } from '../composables/audio_player'
import MessageItem from '../components/MessageItem.vue'
import MessageItemActionCopy from '../components/MessageItemActionCopy.vue'
import MessageItemActionRead from '../components/MessageItemActionRead.vue'
import { Application } from '../types/automation'
import Message from '../models/message'

import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

// init stuff
const audioPlayer = useAudioPlayer(store.config)

const isMas = ref(false)
const actionCopy = ref(null)
const audio = ref(null)
const audioState = ref({
  state: 'idle',
  messageId: null,
})

const props = defineProps({
  message: {
    type: Message,
    required: true,
  },
  sourceApp: {
    type: Object as PropType<Application>,
    required: false,
  },
  allowDirectKeys: {
    type: Boolean,
    default: false,
  },
  showReplace: {
    type: Boolean,
    default: false,
  },
  showClear: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits([
  'drag',
  'close',
  'clear',
  'chat',
  'retry'
])

onMounted(() => {
  
  // shotcuts work better at document level
  document.addEventListener('keydown', onKeyDown)  

  // audio listener init
  audioPlayer.addListener(onAudioPlayerStatus)
  onEvent('audio-noise-detected', () =>  audioPlayer.stop)

  // other stuff
  isMas.value = window.api.isMasBuild

})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  audioPlayer.removeListener(onAudioPlayerStatus)
})

const onMouseDown = (ev: MouseEvent) => {
  const classList: DOMTokenList = (ev.target as HTMLElement)?.classList || new DOMTokenList()
  if (classList.contains('response') || classList.contains('actions')) {
    emit('drag', ev)
  }
}

const onKeyDown = (ev: KeyboardEvent) => {

  // all this requires we have a response
  //if (!message.value) return

  const isCommand = !ev.shiftKey && !ev.altKey && (ev.metaKey || ev.ctrlKey)
  const isShiftCommand = ev.shiftKey && !ev.altKey && (ev.metaKey || ev.ctrlKey)

  // now check
  if ((props.allowDirectKeys || isCommand) && ev.key == 'c') {
    const selection = window.getSelection()
    if (selection == null || selection.isCollapsed) {
      ev.preventDefault()
      actionCopy.value?.copy()
    }
  } else if ((props.allowDirectKeys || isCommand) && ev.key == 'i') {
    ev.preventDefault()
    onInsert()
  } else if (props.showReplace && (props.allowDirectKeys || isCommand) && ev.key == 'r') {
    ev.preventDefault()
    onReplace()
  } else if ((props.allowDirectKeys || isCommand) && ev.key == 't') {
    ev.preventDefault()
    onReadAloud(props.message)
  } else if (((props.allowDirectKeys || isCommand) && ev.key == 'x') || (isCommand && ev.key == 'Escape')) {
    ev.preventDefault()
    onClear()
  } else if ((props.allowDirectKeys || isCommand) && ev.key == 'w') {
    ev.preventDefault()
    onScratchPad()
  } else if ((props.allowDirectKeys || isCommand) && ev.key == 's') {
    ev.preventDefault()
    onChat()
  }

}

const cleanUp = () => {
  audioPlayer.stop()
}

const onClear = () => {
  cleanUp()
  emit('clear')
}

const onClose = () => {
  cleanUp()
  emit('close')
}

const onReplace = () => {
  window.api.automation.replace(props.message.content, props.sourceApp)
}

const onInsert = () => {
  if (!props.showReplace) {
    window.api.automation.replace(props.message.content, props.sourceApp)
  } else {
    window.api.automation.insert(props.message.content, props.sourceApp)
  }
}

const onChat = async () => {
  emit('chat')
}

const onScratchPad = async () => {
  window.api.scratchpad.open(props.message.content)
  emit('close')
}

const onAudioPlayerStatus = (status: AudioStatus) => {
  audioState.value = { state: status.state, messageId: status.uuid }
}

const onReadAloud = async (message: Message) => {
  await audioPlayer.play(audio.value.$el, message.uuid, message.content)
}

const onRetry = async (message: Message) => {
  emit('retry')
}

defineExpose({
  cleanUp
})

</script>

<style>


.actions .action {
  -webkit-app-region: no-drag;
}

.response {
  .body {
    padding-left: 0px;
    margin-left: 0px;
    p:first-child {
      margin-top: 0px !important;
    }
    p:last-child {
      margin-bottom: 16px;
    }
    a {
      cursor: pointer;
    }
    .transient {
      margin-left: 4px;
      .tool-call {
        font-size: 12pt !important;
      }
    }
  }
}

</style>

<style scoped>

.response {
  box-shadow: var(--window-box-shadow);
  background-color: var(--window-bg-color);
  border-radius: var(--border-radius);
  padding: 32px 0px 16px 32px;
  color: var(--text-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .message {
    overflow-y: auto;
    margin-bottom: 0px;
    padding-bottom: 0px;
    padding-left: 0px;
    scrollbar-color: var(--scrollbar-thumb-color) var(--anywhere-bg-color);
  }

  .actions {
    container-type: inline-size;
    container-name: actions;
    display: flex;
    flex-direction: row;
    gap: 12px;
    padding: 8px 24px 8px 0px;
    padding-bottom: 2px;
    color: var(--icon-color);
    font-size: 10pt;

    .action {
      display: flex;
      align-items: center;
      cursor: pointer;
      svg {
        margin-right: 4px;
      }
      &.insert svg {
        margin-top: 4px;
      }
      &.spacer {
        margin-left: auto;
      }
      &.close {
        .narrow {
          border: 1px solid var(--icon-color);
          border-radius: 4px;
          padding: 2px 4px;
          transform: scale(0.65, 0.7);
          margin-right: 0px;
        }
      }
    }
  }
}

@container actions (max-width: 600px) {
  .action.clear {
    display: none !important;
  }
}

@container actions (max-width: 550px) {
  .action.retry {
    display: none !important;
  }
}

@container actions (max-width: 475px) {
  .action.scratchpad {
    display: none !important;
  }
}

</style>
