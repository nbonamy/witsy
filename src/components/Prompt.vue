<template>
  <div class="prompt">
    <BIconFileEarmarkPlus class="icon attach" @click="onAttach" v-if="enableAttachments" />
    <BIconJournalMedical class="icon prompt" @click="onCustomPrompt" v-if="enableCustomPrompts" />
    <div class="input" @paste="onPaste">
      <div v-if="store.pendingAttachment" class="attachment" @click="onDetach">
        <AttachmentView class="attachment" :attachment="store.pendingAttachment" />
      </div>
      <div>
        <textarea v-model="prompt" @keydown="onKeyDown" @keyup="onKeyUp" ref="input" autofocus="true" />
        <BIconMagic class="icon command" @click="onCommands" v-if="enableCommands && prompt" />
      </div>
    </div>
    <BIconStopCircleFill class="icon stop" @click="onStopAssistant" v-if="working" />
    <BIconSendFill class="icon send" @click="onSendPrompt" v-else />
    <Overlay v-if="showCustomPrompts || showCommands" @click="closeContextMenu" />
    <ContextMenu v-if="showCustomPrompts" :show-filter="true" :actions="customPrompts" @action-clicked="handleCustomPromptClick" :x="menuX" :y="menuY" align="bottom" />
    <ContextMenu v-if="showCommands" :actions="commands" @action-clicked="handleCommandClick" :x="menuX" :y="menuY" align="bottom" />
  </div>
</template>

<script setup>

import { ref, computed, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import { BIconStars } from 'bootstrap-icons-vue'
import { canProcessFormat } from '../services/llm'
import { mimeTypeToExtension } from '../main/mimetype'
import ContextMenu from './ContextMenu.vue'
import AttachmentView from './Attachment.vue'
import Attachment from '../models/attachment'
import Overlay from './Overlay.vue'
import Chat from '../models/chat'

import useEventBus from '../composables/useEventBus'
const { onEvent, emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat,
  enableAttachments: {
    type: Boolean,
    default: true
  },
  enableCustomPrompts: {
    type: Boolean,
    default: true
  },
  enableCommands: {
    type: Boolean,
    default: true
  }
})

const prompt = ref('')
const input = ref(null)
const showCustomPrompts = ref(false)
const showCommands = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const engine = () => props.chat?.engine || store.config.llm.engine
const model = () => props.chat?.model || store.config.getActiveModel(engine())

const working = computed(() => {
  return props.chat?.lastMessage().transient
})

const customPrompts = computed(() => {
  return store.prompts.map(p => {
    return { label: p.actor, action: p.actor, icon: BIconStars }
  })
})

const commands = computed(() => {
  return store.commands.filter((c) => c.state == 'enabled').map(c => {
    return { label: c.label, action: c.id, icon: c.icon }
  })
})

onMounted(() => {
  onEvent('set-prompt', onSetPrompt)
  autoGrow(input.value)
})

const onSetPrompt = (message) => {
  store.pendingAttachment = message.attachment
  prompt.value = message.content
  nextTick(() => {
    autoGrow(input.value)
    input.value.focus()
  })
}

const onSendPrompt = () => {
  let message = prompt.value.trim()
  prompt.value = ''
  nextTick(() => {
    autoGrow(input.value)
    emitEvent('sendPrompt', message)
  })
}

const onStopAssistant = () => {
  emitEvent('stopAssistant')
}

const onAttach = () => {
  let file = window.api.file.pick({ /*filters: [
    { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
  ]*/ })
  if (file) {
    const format = file.url.split('.').pop()
    if (canProcessFormat(engine(), model(), format)) {
      emitEvent('attachFile', new Attachment( file.url, format, file.contents))
    } else {
      console.error('Cannot attach format', format)
      alert('This file format is not supported')
    }
  }
}

const onDetach = () => {
  emitEvent('detachFile')
}

const onPaste = (event) => {
  for (let item of event.clipboardData.items) {
    if (item.kind === 'file') {
      let blob = item.getAsFile();
      let reader = new FileReader();
      reader.onload = (event) => {
        if (event.target.readyState === FileReader.DONE) {

          let result = event.target.result
          let format = mimeTypeToExtension(result.split(';')[0].split(':')[1])
          let contents = result.split(',')[1]

          // check before attaching
          if (canProcessFormat(engine(), model(), format)) {
            emitEvent('attachFile', new Attachment('clipboard://', format, contents))
          } else {
            console.error('Cannot attach format', format)
            alert('This file format is not supported')
          }
        }
      }
      reader.readAsDataURL(blob);
    }
  }
}

const onCustomPrompt = () => {
  showCustomPrompts.value = true
  const textarea = document.querySelector('.prompt textarea')
  const rect = textarea?.getBoundingClientRect()
  menuX.value = rect?.left - 12
  menuY.value = rect?.height + 32
}

const closeContextMenu = () => {
  showCustomPrompts.value = false
  showCommands.value = false
}

const handleCustomPromptClick = (action) => {
  closeContextMenu()
  const customPrompt = store.prompts.find(p => p.actor === action)
  prompt.value = customPrompt.prompt
  nextTick(() => {

    // grow
    autoGrow(input.value)

    // select variable text
    const start = prompt.value.indexOf('"')
    if (start > 0) {
      const end = prompt.value.indexOf('"', start + 1)
      if (end > 0) {
        input.value.setSelectionRange(start + 1, end)
      }
    }

    // focus
    input.value.focus()

  })
}

const onCommands = () => {
  showCommands.value = true
  const textarea = document.querySelector('.prompt textarea')
  const rect = textarea?.getBoundingClientRect()
  menuX.value = rect?.right - 250
  menuY.value = rect?.height + 32
}

const handleCommandClick = (action) => {
  closeContextMenu()
  const command = store.commands.find(c => c.id === action)
  prompt.value = command.template.replace('{input}', prompt.value)
  onSendPrompt()
}

let draftPrompt = ''
const onKeyDown = (event) => {

  if (event.key === 'Enter') {
    if (event.shiftKey) {

    } else {
      onSendPrompt()
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {

    // need at list shift
    if (!event.shiftKey) {
      return
    }
    
    // get messages
    let userMessages = props.chat?.messages.filter(m => m.role === 'user')
    if (event.controlKey || event.metaKey) {
      userMessages = store.chats.reduce((acc, chat) => {
        return acc.concat(chat.messages.filter(m => m.role === 'user'))
      }, [])
      userMessages.sort((a, b) => a.createdAt - b.createdAt)
    }

    // new prompt
    let newPrompt = null

    // now navigate
    if (userMessages?.length) {
      const index = userMessages.findIndex(m => m.content === prompt.value)
      if (event.key === 'ArrowUp') {
        if (index === -1) {
          draftPrompt = prompt.value
          newPrompt = userMessages[userMessages.length - 1].content
        } else if (index > 0) {
          newPrompt = userMessages[index - 1].content
        } else {
          // keydown moved caret at beginning
          // so move it back to the end
          // const length = prompt.value.length;
          // input.value.setSelectionRange(length, length);
        }
      } else {
        if (index >= 0 && index < userMessages.length - 1) {
          newPrompt = userMessages[index + 1].content
        } else if (index != -1) {
          newPrompt = draftPrompt
        }
      }
    }

    // update
    if (newPrompt) {
      prompt.value = newPrompt
      nextTick(() => {
        autoGrow(input.value)
        input.value.setSelectionRange(newPrompt.length, newPrompt.length)
        if (input.value.scrollTo) {
          // no scrollTo while testing
          input.value.scrollTo(0, input.value.scrollHeight)
        }
      })
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  }
}

const onKeyUp = (event) => {
  nextTick(() => {
    autoGrow(event.target)
  })
}

const autoGrow = (element) => {
  if (element) {
    // reset before calculating
    element.style.height = '0px'
    element.style.height = Math.min(150, element.scrollHeight) + 'px'
    emitEvent('promptResize', element.style.height)
  }
}

</script>

<style scoped>

.prompt {
  padding: 8px 12px;
  display: flex;
  align-items: center;
}

.prompt .icon {
  cursor: pointer;
  color: #5b5a59;
}

.attachment .icon {
  height: 18pt !important;
  width: 18pt !important;
}

.input {
  border: 1px solid #bbbbbb;
  border-radius: 16px;
  margin: 0px 8px;
  overflow: hidden;
  flex: 1;
}

.input .attachment {
  margin-top: 4px;
  margin-left: 8px;
}

.input div:has(textarea) {
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.input div:has(textarea) .icon {
  position: absolute;
  border-radius: 16px;
  margin-top: -2px;
  margin-left: 8px;
  right: 12px;
}

.input textarea {
  border: none;
  resize: none;
  box-sizing: border-box;
  border-radius: 16px;
  overflow-x: hidden;
  overflow-y: auto;
  font-size: 11.5pt;
  padding-left: 16px;
  padding-right: 36px;
  padding-top: 5px;
  padding-bottom: 7px;
  flex: 1;
} 

.input .attachment img {
  height: 36pt !important;
  width: 36pt !important;
  object-fit: cover;
}

.input textarea:focus {
  outline: none;
  flex: 1;
}

::-webkit-scrollbar {
  height: 1rem;
  width: .5rem;
}

::-webkit-scrollbar-thumb {
  background-color: #e1e1e1;
  border-color: rgba(255,255,255,var(--tw-border-opacity));
  border-radius: 9999px;
  border-width: 1px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(227,227,227,var(--tw-bg-opacity));
}

::-webkit-scrollbar-track {
  background-color: transparent;
  border-radius: 9999px;
}

</style>
