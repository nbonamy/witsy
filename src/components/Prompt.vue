<template>
  <div class="prompt">
    <div class="icons-left" :class="iconsLeftCount">
      <BIconDatabase :class="{ icon: true, docrepo: true, active: docRepoActive }" @click="onDocRepo" v-if="enableDocRepo" />
      <BIconJournalMedical class="icon experts" @click="onExperts" v-if="enableExperts" />
      <BIconFileEarmarkPlus class="icon attach" @click="onAttach" v-if="enableAttachments" />
      <BIconMic :class="{ icon: true,  dictate: true, active: dictating }" @click="onDictate" @contextmenu="onConversationMenu" v-if="hasDictation"/>
    </div>
    <div class="input" @paste="onPaste">
      <div v-if="store.pendingAttachment" class="attachment" @click="onDetach">
        <AttachmentView class="attachment" :attachment="store.pendingAttachment" />
      </div>
      <div class="textarea-wrapper">
        <div class="icon left processing loader-wrapper" v-if="isProcessing"><Loader /><Loader /><Loader /></div>
        <textarea v-model="prompt" @keydown="onKeyDown" @keyup="onKeyUp" ref="input" autofocus="true" :disabled="conversationMode" />
        <BIconMagic class="icon command right" @click="onCommands" v-if="enableCommands && prompt" />
      </div>
    </div>
    <BIconStopCircleFill class="icon stop" @click="onStopAssistant" v-if="working" />
    <BIconSendFill class="icon send" @click="onSendPrompt" v-else />
    <ContextMenu v-if="showDocRepo" :on-close="closeContextMenu" :actions="docReposMenuItems" @action-clicked="handleDocRepoClick" :x="menuX" :y="menuY" align="bottom" />
    <ContextMenu v-if="showExperts" :on-close="closeContextMenu" :show-filter="true" :actions="experts" @action-clicked="handleExpertClick" :x="menuX" :y="menuY" align="bottom" />
    <ContextMenu v-if="showCommands" :on-close="closeContextMenu" :actions="commands" @action-clicked="handleCommandClick" :x="menuX" :y="menuY" align="bottom" />
    <ContextMenu v-if="showConversationMenu" :on-close="closeContextMenu" :actions="conversationMenu" @action-clicked="handleConversationClick" :x="menuX" :y="menuY" align="bottom" />
  </div>
</template>

<script setup>

import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { store } from '../services/store'
import { BIconStars } from 'bootstrap-icons-vue'
import { canProcessFormat } from '../services/llm'
import { mimeTypeToExtension, extensionToMimeType } from '../main/mimetype'
import useAudioRecorder, { isAudioRecordingSupported } from '../composables/audio_recorder'
import useTranscriber from '../composables/transcriber'
import ContextMenu from './ContextMenu.vue'
import AttachmentView from './Attachment.vue'
import Attachment from '../models/attachment'
import Loader from './Loader.vue'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat,
  conversationMode: String,
  enableDocRepo: {
    type: Boolean,
    default: true
  },
  enableAttachments: {
    type: Boolean,
    default: true
  },
  enableExperts: {
    type: Boolean,
    default: true
  },
  inlineMenus: {
    type: Boolean,
    default: true
  },
  enableCommands: {
    type: Boolean,
    default: true
  },
  enableDictation: {
    type: Boolean,
    default: true
  },
  enableConversation: {
    type: Boolean,
    default: true
  },
  processing: {
    type: Boolean,
    default: false
  }
})

// init stuff
const audioRecorder = useAudioRecorder(store.config)
const transcriber = useTranscriber(store.config)
let userStoppedDictation = false

const prompt = ref('')
const input = ref(null)
const docRepos = ref([])
const showDocRepo = ref(false)
const showExperts = ref(false)
const showCommands = ref(false)
const showConversationMenu = ref(false)
const hasDictation = ref(false)
const dictating = ref(false)
const processing = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const engine = () => props.chat?.engine || store.config.llm.engine
const model = () => props.chat?.model || store.config.getActiveModel(engine())

const iconsLeftCount = computed(() => {
  const count = (props.enableAttachments ? 1 : 0) + (props.enableExperts ? 1 : 0) + (props.enableDictation ? 1 : 0)
  return `icons-left-${count > 1 ? 'many' : count}`
})

const isProcessing = computed(() => {
  return processing.value || props.processing
})

const working = computed(() => {
  return props.chat?.lastMessage().transient
})

const docRepoActive = computed(() => {
  return props.chat?.docrepo || store.pendingDocRepo
})

const docReposMenuItems = computed(() => {
  const menus = docRepos.value.map(d => {
    return { label: d.name, action: d.uuid }
  })
  if (menus.length > 0) {
    menus.push({ separator: true })
  }
  if (docRepoActive.value) {
    menus.push({ label: 'Disconnect', action: 'disconnect' })
  }
  menus.push({ label: 'Manage...', action: 'manage' })
  return menus
})

const experts = computed(() => {
  return store.experts.filter(p => p.state == 'enabled').map(p => {
    return { label: p.name, action: p.name, icon: BIconStars }
  })
})

const commands = computed(() => {
  return store.commands.filter((c) => c.state == 'enabled').map(c => {
    return { label: c.label, action: c.id, icon: c.icon }
  })
})

const conversationMenu = computed(() => {
  if (props.conversationMode) {
    return [
      { label: 'Stop conversation', action: null }
    ]
  } else {
    return [
      { label: 'Start automatic conversation', action: 'auto' },
      { label: 'Start push-to-talk conversation', action: 'ptt' },
    ]
  }
})

onMounted(() => {

  // event
  onEvent('set-prompt', onSetPrompt)
  onEvent('set-expert-prompt', onSetExpertPrompt)
  window.api.on('docrepo-modified', loadDocRepos)
  autoGrow(input.value)

  // other stuff
  loadDocRepos()
  initDictation()

})

const defaultPrompt = (conversationMode) => {
  if (conversationMode === 'auto') {
    return 'You can start talking now...'
  } else if (conversationMode === 'ptt') {
    return 'Press and hold space to talk...'
  } else {
    return ''
  }
}

const initDictation = async () => {

  // needed?
  if (!props.enableDictation) {
    return
  }

  // check
  const supported = await isAudioRecordingSupported()
  if (!supported) {
    return
  }

  // this should be good enough
  hasDictation.value = true

  // push-to-talk stuff
  const onKeyUpPTT = () => {
    //console.log('Stopping push-to-talk dictation')
    document.removeEventListener('keyup', onKeyUpPTT)
    stopDictation(false)
  }
  document.addEventListener('keydown', (event) => {
    if (props.conversationMode == 'ptt' && event.code === 'Space' && dictating.value === false) {
      //console.log('Starting push-to-talk dictation')
      document.addEventListener('keyup', onKeyUpPTT)
      startDictation()
    }
  })

}

const loadDocRepos = () => {
  if (props.enableDocRepo) {
    docRepos.value = window.api.docrepo.list()
  }
}

const onSetPrompt = (message) => {
  store.pendingAttachment = message.attachment
  prompt.value = message.content
  nextTick(() => {
    autoGrow(input.value)
    input.value.focus()
  })
}

const onSetExpertPrompt = (message) => {
  store.pendingAttachment = null
  prompt.value = message
  nextTick(() => {
    autoGrow(input.value)
    selectPromptQuotedPart()
    input.value.focus()
  })
}

const onSendPrompt = () => {
  let message = prompt.value.trim()
  prompt.value = defaultPrompt(props.conversationMode)
  nextTick(() => {
    autoGrow(input.value)
    emitEvent('send-prompt', message)
  })
}

const onStopAssistant = () => {
  emitEvent('stop-assistant')
}

const onAttach = () => {
  let file = window.api.file.pick({ /*filters: [
    { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
  ]*/ })
  if (file) {
    const format = file.url.split('.').pop()
    if (canProcessFormat(engine(), model(), format)) {
      const mimeType = extensionToMimeType(format)
      emitEvent('attach-file', new Attachment(file.url, mimeType, file.contents))
    } else {
      console.error('Cannot attach format', format)
      alert('This file format is not supported')
    }
  }
}

const onDetach = () => {
  emitEvent('detach-file')
}

const onPaste = (event) => {
  for (let item of event.clipboardData.items) {
    if (item.kind === 'file') {
      let blob = item.getAsFile();
      let reader = new FileReader();
      reader.onload = (event) => {
        if (event.target.readyState === FileReader.DONE) {

          let result = event.target.result
          let mimeType = result.split(';')[0].split(':')[1]
          let format = mimeTypeToExtension(mimeType)
          let contents = result.split(',')[1]

          // check before attaching
          if (canProcessFormat(engine(), model(), format)) {
            emitEvent('attach-file', new Attachment('clipboard://', mimeType, contents))
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

const onExperts = () => {
  if (props.inlineMenus) {
    showExperts.value = true
    const icon = document.querySelector('.prompt .experts')
    const rect = icon?.getBoundingClientRect()
    menuX.value = rect?.left
    menuY.value = rect?.height + 32
  } else {
    emitEvent('show-experts')
  }
}

const onDictate = async () => {
  if (dictating.value) {
    stopDictation(true)
    stopConversation()
  } else {
    startDictation()
  }
}

const stopDictation = async (userStopped = false) => {
  userStoppedDictation = userStopped
  audioRecorder.stop()
}

const startDictation = async () => {

  // transcriber
  transcriber.initialize()

  // audio recorder
  await audioRecorder.initialize({

    onNoiseDetected: () => {
      emitEvent('audio-noise-detected')
    },
    
    onSilenceDetected: () => {

      // depends on configuration
      if (store.config.stt.silenceAction === 'nothing') {
        return
      }

      // no silence in ptt conversation
      if (props.conversationMode === 'ptt') {
        return
      }

      // we dictate anyway
      stopDictation(false)

    },
    
    onRecordingComplete: async (audioChunks, noiseDetected) => {

      try {

        // do that always
        audioRecorder.release()

        // update
        prompt.value = defaultPrompt(props.conversationMode)
        dictating.value = false

        // if no noise stop everything
        if (!noiseDetected) {
          return
        }

        // transcribe
        processing.value = true
        const response = await transcriber.transcribe(audioChunks)
        if (response) {
          prompt.value = response.text
        }

        // execute?
        if (props.conversationMode || store.config.stt.silenceAction === 'stop_execute' || store.config.stt.silenceAction === 'execute_continue') {

          // send prompt
          onSendPrompt()

          // record again?
          if (userStoppedDictation === false && (props.conversationMode === 'auto' || store.config.stt.silenceAction === 'execute_continue')) {
            startDictation()
          }
        
        }

      } catch (error) {
        console.error(error)
        alert('Error transcribing audio')
      }

      // update
      processing.value = false

    },
  })

  // start
  dictating.value = true
  audioRecorder.start()

}

const onConversationMenu = (event) => {
  if (!props.enableConversation) return
  if (props.inlineMenus) {
    showConversationMenu.value = true
    const icon = document.querySelector('.prompt .dictate')
    const rect = icon?.getBoundingClientRect()
    menuX.value = rect?.left
    menuY.value = rect?.height + 32
  } else {
    emitEvent('show-conversation-menu')
  }
}

const handleConversationClick = (action) => {
  closeContextMenu()
  emitEvent('conversation-mode', action)
  prompt.value = defaultPrompt(action)
  if (action === 'auto') {
    startDictation()
  } else if (action === 'ptt') {
    // nothing to do
  } else {
    stopDictation(true)
    stopConversation()
  }
}

const stopConversation = () => {
  emitEvent('audio-noise-detected')
  emitEvent('conversation-mode', null)
}

const onDocRepo = (event) => {
  showDocRepo.value = true
  const icon = document.querySelector('.prompt .docrepo')
  const rect = icon?.getBoundingClientRect()
  menuX.value = rect?.left
  menuY.value = rect?.height + 32
}

const handleDocRepoClick = (action) => {
  closeContextMenu()
  if (action === 'manage') {
    emitEvent('open-doc-repos')
  } else if (action === 'disconnect') {
    if (props.chat) {
      props.chat.docrepo = null
    }
    store.pendingDocRepo = null
    window.api.docrepo.disconnect()
  } else {
    window.api.docrepo.connect(action)
    if (props.chat) {
      props.chat.docrepo = action
    } else {
      store.pendingDocRepo = action
    }
  }
}

const closeContextMenu = () => {
  showDocRepo.value = false
  showExperts.value = false
  showCommands.value = false
  showConversationMenu.value = false
}

const handleExpertClick = (action) => {
  closeContextMenu()
  const expert = store.experts.find(p => p.name === action)
  onSetExpertPrompt(expert.prompt)
}

const selectPromptQuotedPart = () => {
  const start = prompt.value.indexOf('"')
  if (start > 0) {
    const end = prompt.value.indexOf('"', start + 1)
    if (end > 0) {
      input.value.setSelectionRange(start + 1, end)
    }
  }
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
    emitEvent('prompt-resize', element.style.height)
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

.prompt .icon.active {
  color: var(--highlight-color);
}

.prompt .icon.dictate.active {
  color: red;
}

.prompt .icons-left-many .icon {
  padding-left: 4px;
  padding-right: 4px;
}

.attachment .icon {
  height: 18pt !important;
  width: 18pt !important;
}

.input {
  background-color: white;
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

.textarea-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.textarea-wrapper .icon.left {
  position: absolute;
  border-radius: 16px;
  margin-top: -2px;
  left: 4px;
}

.textarea-wrapper .icon.left + textarea {
  padding-left: 44px;
}

.textarea-wrapper .loader-wrapper {
  margin-top: 1px;
  display: flex;
  justify-content: center;
  gap: 8px;
  transform: scale(0.5);
  :nth-child(1), :nth-child(3) {
    animation-delay: 250ms;
  }
  .loader {
    background-color: #888;
  }
}

.textarea-wrapper .icon.right {
  position: absolute;
  border-radius: 16px;
  margin-top: -2px;
  margin-left: 8px;
  right: 12px;
}

.textarea-wrapper textarea {
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

.textarea-wrapper textarea:disabled {
  color: #888;
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
