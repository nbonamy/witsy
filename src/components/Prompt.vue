<template>
  <div class="prompt">
    <BIconFileEarmarkPlus class="icon attach" @click="onAttach"/>
    <div class="input">
      <div v-if="store.pendingAttachment" class="attachment" @click="onDetach">
        <BIconPaperclip class="icon" />
      </div>
      <textarea @keydown.enter="onEnter" @keyup="onKeyUp" v-model="prompt" ref="input" autofocus />
    </div>
    <BIconSquareFill class="icon" @click="onStopAssistant" v-if="working" />
    <BIconSendFill class="icon" @click="onSendPrompt" v-else />
  </div>
</template>

<script setup>

import { ref, computed, onMounted } from 'vue'
import { ipcRenderer } from 'electron'
import { store } from '../services/store'
import Chat from '../models/chat'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat
})

const prompt = ref('')
const input = ref(null)

const working = computed(() => {
  return props.chat.lastMessage().transient
})

onMounted(() => {
  autoGrow(input.value)
})

const onSendPrompt = () => {
  emitEvent('sendPrompt', prompt.value)
  prompt.value = ''
}

const onStopAssistant = () => {
  emitEvent('stopAssistant')
}

const onAttach = () => {
  let file = ipcRenderer.sendSync('pick-file', { filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }] })
  if (file) {
    emitEvent('attachFile', file)
  }
}

const onDetach = () => {
  emitEvent('detachFile')
}

const onKeyUp = (event) => {
  autoGrow(event.target)
}

const onEnter = (event) => {
  if (event.shiftKey) {

  } else {
    onSendPrompt()
    event.preventDefault()
    event.stopPropagation()
    return false
  }
}

const autoGrow = (element) => {
  element.style.height = '5px'
  element.style.height = (element.scrollHeight) + 'px'
}

</script>

<style scoped>

.prompt {
  padding: 8px 12px;
  display: flex;
  align-items: center;
}

.icon {
  cursor: pointer;
  color: #5b5a59;
  height: 14pt !important;
  width: 14pt !important;
}

.input {
  border: 1px solid #bbbbbb;
  border-radius: 8px;
  margin: 0px 8px;
  padding: 4px 12px 1px;
  flex: 1;
  display: flex;
}

.input:has(.attachment) {
  padding-left: 0px;
}

.input .attachment {
  margin-top: 2.5px;
  margin-right: 2px;
}

.input textarea {
  border: none;
  resize: none;
  overflow: hidden;
  font-size: 11.5pt;
  flex: 1;
} 

.input textarea:focus {
  outline: none;
  flex: 1;
}

.input .icon {
  margin-left: 8px;
}

</style>
