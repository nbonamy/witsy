<template>
  <div class="prompt">
    <BIconFileEarmarkPlus class="icon attach" @click="onAttach"/>
    <div class="input" @paste="onPaste">
      <div v-if="store.pendingAttachment" class="attachment" @click="onDetach">
        <img :src="attachmentUrl" class="icon" />
      </div>
      <textarea v-model="prompt" @keydown="onKeyDown" @keyup="onKeyUp" ref="input" autofocus />
    </div>
    <BIconStopCircleFill class="icon stop" @click="onStopAssistant" v-if="working" />
    <BIconSendFill class="icon send" @click="onSendPrompt" v-else />
  </div>
</template>

<script setup>

import { ref, computed, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import Chat from '../models/chat'

import useEventBus from '../composables/useEventBus'
const { onEvent, emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat
})

const prompt = ref('')
const input = ref(null)

const working = computed(() => {
  return props.chat?.lastMessage().transient
})

const attachmentUrl = computed(() => {
  if (store.pendingAttachment?.contents) {
    return 'data:image/png;base64,' + store.pendingAttachment.contents
  } else {
    return store.pendingAttachment?.url
  }
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
  let file = window.api.file.pick({ filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }] })
  if (file) {
    emitEvent('attachFile', {...file, downloaded: false })
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
          let format = result.split(';')[0].split('/')[1]
          let contents = result.split(',')[1]
          emitEvent('attachFile', {
            url: 'clipboard://',
            format: format,
            contents: contents,
            downloaded: false 
          })
        }
      }
      reader.readAsDataURL(blob);
    }
  }
}

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
    event.preventDefault()
    event.stopPropagation()
    return false
  }
}



const onKeyUp = (event) => {

  // history
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    
    // get messages
    let userMessages = props.chat?.messages.filter(m => m.role === 'user')
    if (event.shiftKey) {
      userMessages = store.chats.reduce((acc, chat) => {
        return acc.concat(chat.messages.filter(m => m.role === 'user'))
      }, [])
      userMessages.sort((a, b) => a.createdAt - b.createdAt)
    }

    // now navigate
    if (userMessages?.length) {
      const index = userMessages.findIndex(m => m.content === prompt.value)
      if (event.key === 'ArrowUp') {
        if (index === -1) {
          prompt.value = userMessages[userMessages.length - 1].content
        } else if (index > 0) {
          prompt.value = userMessages[index - 1].content
        } else {
          // keydown moved caret at beginning
          // so move it back to the end
          // const length = prompt.value.length;
          // input.value.setSelectionRange(length, length);
        }
      } else {
        if (index >= 0 && index < userMessages.length - 1) {
          prompt.value = userMessages[index + 1].content
        } else if (index != -1) {
          prompt.value = ''
        }
      }
    }
  }

  // auto-grow
  nextTick(() => {
    autoGrow(event.target)
  })
}

const autoGrow = (element) => {
  element.style.height = '5px'
  element.style.height = Math.min(150, element.scrollHeight) + 'px'
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
}

.input .attachment {
  margin-top: 2.5px;
  margin-right: 2px;
}

.input textarea {
  border: none;
  resize: none;
  overflow-x: hidden;
  overflow-y: auto;
  font-size: 11.5pt;
  width: 100%;
} 

.input textarea:focus {
  outline: none;
  flex: 1;
}

.input .icon {
  margin-left: 8px;
}

.input .attachment img {
  height: 36pt !important;
  width: 36pt !important;
  object-fit: cover;
}

</style>
