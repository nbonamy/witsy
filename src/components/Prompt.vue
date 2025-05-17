<template>
  <div class="prompt">
    <slot name="before" />
    <div class="actions" :class="actionsCount">
      <BIconDatabase :class="{ icon: true, docrepo: true, active: docRepoActive }" @click="onDocRepo" v-if="enableDocRepo" />
      <BIconMortarboard class="icon experts" @click="onClickExperts" v-if="enableExperts" />
      <BIconPaperclip class="icon attach" @click="onAttach" v-if="enableAttachments" />
      <BIconMic :class="{ icon: true,  dictate: true, active: dictating }" @click="onDictate" @contextmenu="onConversationMenu" v-if="hasDictation"/>
      <slot name="actions" />
    </div>
    <slot name="between" />
    <div class="input" @paste="onPaste">
      <div v-if="attachment" class="attachment" @click="onDetach">
        <AttachmentView class="attachment" :attachment="attachment" />
      </div>
      <div class="textarea-wrapper">
        <div class="icon left processing loader-wrapper" v-if="isProcessing"><Loader /><Loader /><Loader /></div>
        <div v-if="expert" class="icon left expert" @click="onClickActiveExpert"><BIconMortarboard /></div>
        <textarea v-model="prompt" :placeholder="placeholder" @keydown="onKeyDown" @keyup="onKeyUp" ref="input" autofocus="true" :disabled="conversationMode?.length > 0" />
        <BIconMagic class="icon command right" @click="onCommands" v-if="enableCommands && prompt" />
      </div>
    </div>
    <slot name="after" />
    <BIconStopCircleFill class="icon stop" @click="onStopPrompting" v-if="isPrompting" />
    <BIconSendFill class="icon send" @click="onSendPrompt" v-else />
    <ContextMenu v-if="showDocRepo" :on-close="closeContextMenu" :actions="docReposMenuItems" @action-clicked="handleDocRepoClick" :x="menuX" :y="menuY" :position="menusPosition" />
    <ContextMenu v-if="showExperts" :on-close="closeContextMenu" :show-filter="true" :actions="expertsMenuItems" @action-clicked="handleExpertClick" :x="menuX" :y="menuY" :position="menusPosition" />
    <ContextMenu v-if="showActiveExpert" :on-close="closeContextMenu" :actions="activeExpertMenuItems" @action-clicked="handleExpertClick" :x="menuX" :y="menuY" :position="menusPosition" />
    <ContextMenu v-if="showCommands" :on-close="closeContextMenu" :actions="commands" @action-clicked="handleCommandClick" :x="menuX" :y="menuY" :position="menusPosition" />
    <ContextMenu v-if="showConversationMenu" :on-close="closeContextMenu" :actions="conversationMenu" @action-clicked="handleConversationClick" :x="menuX" :y="menuY" :position="menusPosition" />
  </div>
</template>

<script setup lang="ts">

import { FileContents, Expert } from '../types/index'
import { DocumentBase } from '../types/rag'
import { ref, computed, onMounted, onUnmounted, nextTick, watch, Ref, PropType } from 'vue'
import { store } from '../services/store'
import { expertI18n, commandI18n, t } from '../services/i18n'
import { BIconStars } from 'bootstrap-icons-vue'
import LlmFactory, { ILlmManager } from '../llms/llm'
import { mimeTypeToExtension, extensionToMimeType } from 'multi-llm-ts'
import useAudioRecorder, { isAudioRecordingSupported } from '../composables/audio_recorder'
import useTipsManager from '../composables/tips_manager'
import useTranscriber from '../composables/transcriber'
import ImageUtils from '../composables/image_utils'
import Dialog from '../composables/dialog'
import ContextMenu, { type MenuAction } from './ContextMenu.vue'
import AttachmentView from './Attachment.vue'
import Attachment from '../models/attachment'
import Message from '../models/message'
import Loader from './Loader.vue'
import Chat from '../models/chat'

export type SendPromptParams = {
  prompt: string,
  attachment: Attachment|null
  docrepo: string|null,
  expert: Expert|null
}

export type HistoryProvider = (event: KeyboardEvent) => string[]

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const props = defineProps({
  chat: {
    type: Object as PropType<Chat>,
    required: true
  },
  conversationMode: {
    type: String,
    required: false
  },
  placeholder: {
    type: String,
    required: false,
    default: t('prompt.placeholders.default')
  },
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
  menusPosition: {
    type: String,
    default: 'above'
  },
  enableCommands: {
    type: Boolean,
    default: true
  },
  enableDictation: {
    type: Boolean,
    default: true
  },
  enableConversations: {
    type: Boolean,
    default: true
  },
  processing: {
    type: Boolean,
    default: false
  },
  historyProvider: {
    type: Function as PropType<HistoryProvider>,
    default: (_: KeyboardEvent): string[] => []
  }
})

// init stuff
const audioRecorder = useAudioRecorder(store.config)
const transcriber = useTranscriber(store.config)
const tipsManager = useTipsManager(store)
const llmManager = LlmFactory.manager(store.config)
let userStoppedDictation = false

const prompt = ref('')
const expert: Ref<Expert|null> = ref(null)
const attachment = ref(null)
const docrepo = ref(null)
const input = ref(null)
const docRepos: Ref<DocumentBase[]> = ref([])
const showDocRepo = ref(false)
const showExperts = ref(false)
const showActiveExpert = ref(false)
const showCommands = ref(false)
const showConversationMenu = ref(false)
const hasDictation = ref(false)
const dictating = ref(false)
const processing = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const engine = () => props.chat?.engine || llmManager.getChatEngineModel().engine
const model = () => props.chat?.model || llmManager.getChatEngineModel().model

const backSpaceHitsToClearExpert = 1
let backSpaceHitsWhenEmpty = 0

const actionsCount = computed(() => {
  const count = (props.enableAttachments ? 1 : 0) + (props.enableExperts ? 1 : 0) + (props.enableDictation ? 1 : 0)
  return `actions-${count > 1 ? 'many' : count}`
})

const isProcessing = computed(() => {
  return processing.value || props.processing
})

const isPrompting = computed(() => {
  return props.chat?.lastMessage()?.transient
})

const docRepoActive = computed(() => {
  return props.chat?.docrepo || docrepo.value
})

const docReposMenuItems = computed(() => {
  const menus: MenuAction[] = docRepos.value.map(d => {
    return { label: d.name, action: d.uuid }
  })
  if (menus.length > 0 && docRepoActive.value) {
    menus.push({ separator: true })
  }
  if (docRepoActive.value) {
    menus.push({ label: 'Disconnect', action: 'disconnect' })
  }
  return menus
})

const expertsMenuItems = computed(() => {
  return store.experts.filter((p: Expert) => p.state == 'enabled').map(p => {
    return { label: p.name || expertI18n(p, 'name'), action: p.id, icon: BIconStars }
  })
})

const activeExpertMenuItems = computed(() => {
  return [
    { label: expert.value.name || expertI18n(expert.value, 'name'), icon: BIconStars },
    { label: expert.value.prompt || expertI18n(expert.value, 'prompt'), disabled: true, wrap: true },
    { separator: true },
    { label: t('prompt.expert.clear'), action: 'clear' },
  ];
})

const commands = computed(() => {
  return store.commands.filter((c) => c.state == 'enabled').map(c => {
    return { label: c.label ?? commandI18n(c, 'label'), action: c.id, icon: c.icon }
  })
})

const conversationMenu = computed(() => {
  if (props.conversationMode) {
    return [
      { label: t('prompt.conversation.stop'), action: null }
    ]
  } else {
    return [
      { label: t('prompt.conversation.startAuto'), action: 'auto' },
      { label: t('prompt.conversation.startPTT'), action: 'ptt' },
    ]
  }
})

onMounted(() => {

  // global shorcuts
  document.addEventListener('keydown', onGlobalKeyDown)

  // event
  onEvent('set-prompt', onSetPrompt)
  window.api.on('docrepo-modified', loadDocRepos)
  window.api.on('start-dictation', onDictate)
  autoGrow(input.value)

  // other stuff
  loadDocRepos()
  initDictation()

  // reset doc repo and expert
  watch(() => props.chat || {}, () => {
    docrepo.value = props.chat?.docrepo
  }, { immediate: true })

})

onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKeyDown)
  window.api.off('docrepo-modified', loadDocRepos)
  window.api.off('start-dictation', onDictate)
})

const defaultPrompt = (conversationMode: string) => {
  if (conversationMode === 'auto') {
    return t('prompt.conversation.placeholders.auto')
  } else if (conversationMode === 'ptt') {
    return t('prompt.conversation.placeholders.ptt')
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

const onSetPrompt = (message: Message) => {
  prompt.value = message.content
  attachment.value = message.attachment
  expert.value = message.expert
  nextTick(() => {
    autoGrow(input.value)
    input.value.focus()
    try {
      input.value.scrollTo(0, input.value.scrollHeight)
    } catch {}
  })
}

const setExpert = (xpert: Expert) => {
  expert.value = xpert
  if (prompt.value == '@') {
    prompt.value = ''
  }
  nextTick(() => {
    input.value?.focus()
  })
}

const onSendPrompt = () => {
  let message = prompt.value.trim()
  prompt.value = defaultPrompt(props.conversationMode)
  nextTick(() => {
    autoGrow(input.value)
    emitEvent('send-prompt', {
      prompt: message,
      attachment: attachment.value || null,
      docrepo: docrepo.value || null,
      expert: expert.value || null
    } as SendPromptParams)
    attachment.value = null
  })
}

const onStopPrompting = () => {
  emitEvent('stop-prompting', null)
}

const onAttach = () => {
  let file = window.api.file.pick({ /*filters: [
    { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
  ]*/ })
  if (file) {
    const fileContents = file as FileContents
    const format = fileContents.url.split('.').pop()
    if (llmManager.canProcessFormat(engine(), model(), format)) {
      const mimeType = extensionToMimeType(format)
      attach(fileContents.contents, mimeType, fileContents.url)
    } else {
      console.error('Cannot attach format', format)
      Dialog.alert('This file format is not supported')
    }
  }
}

const onPaste = (event: ClipboardEvent) => {
  for (let item of event.clipboardData.items) {
    if (item.kind === 'file') {
      let blob = item.getAsFile();
      let reader = new FileReader();
      reader.onload = (event) => {
        if (event.target.readyState === FileReader.DONE) {

          let result = event.target.result as string
          let mimeType = result.split(';')[0].split(':')[1]
          let format = mimeTypeToExtension(mimeType)
          let contents = result.split(',')[1]

          // check before attaching
          if (llmManager.canProcessFormat(engine(), model(), format)) {
            attach(contents, mimeType, 'clipboard://')
          } else {
            console.error('Cannot attach format', format)
            Dialog.alert('This file format is not supported')
          }
        }
      }
      reader.readAsDataURL(blob);
      event.preventDefault();
    }
  }
}

const attach = async (contents: string, mimeType: string, url: string) => {
  const toAttach = new Attachment(contents, mimeType, url)
  if (toAttach.isImage() && store.config.llm.imageResize > 0) {
    try {
      ImageUtils.resize(`data:${mimeType};base64,${contents}`, store.config.llm.imageResize, (resizedContent, resizedMimeTyoe) => {
        attachment.value = new Attachment(resizedContent, resizedMimeTyoe, url)
      })
    } catch (e) {
      console.error('Error resizing image', e)
      attachment.value = toAttach
    }
  } else {
    attachment.value = toAttach
  }
}

const onDetach = () => {
  attachment.value = null
}

const openExperts = () => {
  const icon = document.querySelector('.prompt .experts')
  const rect = icon?.getBoundingClientRect()
  menuX.value = rect?.left + (props.menusPosition === 'below' ? -10 : 0)
  menuY.value = rect?.height + (props.menusPosition === 'below' ? rect?.y : 8 )  + 24
  showExperts.value = true
}

const onClickExperts = () => {
  openExperts()
}

const onClickActiveExpert = () => {
  const icon = document.querySelector('.prompt .expert')
  const rect = icon?.getBoundingClientRect()
  menuX.value = rect?.left + (props.menusPosition === 'below' ? -10 : 0)
  menuY.value = rect?.height + (props.menusPosition === 'below' ? rect?.y : 8 )  + 24
  showActiveExpert.value = true
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
  transcriber.endStreaming()
  audioRecorder.stop()
}

const startDictation = async () => {

  // transcriber
  transcriber.initialize()

  // audio recorder
  await audioRecorder.initialize({

    pcm16bitStreaming: transcriber.requiresPcm16bits,
    listener: {

      onNoiseDetected: () => {
        emitEvent('audio-noise-detected', null)
      },
      
      onAudioChunk: async (chunk) => {
          if (transcriber.streaming) {
            await transcriber.sendStreamingChunk(chunk)
          }
        },

      onSilenceDetected: () => {

        // // depends on configuration
        // if (store.config.stt.silenceAction === 'nothing') {
        //   return
        // }

        // no silence in ptt conversation
        if (props.conversationMode === 'ptt') {
          return
        }

        // we dictate anyway
        stopDictation(false)

      },
      
      onRecordingComplete: async (audioChunks: Blob[], noiseDetected: boolean) => {

        try {

          // do that always
          audioRecorder.release()
          dictating.value = false

          // if streaming we are all done
          if (audioChunks.length) {

            // update
            prompt.value = defaultPrompt(props.conversationMode)

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

          }

          // execute?
          if (props.conversationMode/* || store.config.stt.silenceAction === 'stop_execute' || store.config.stt.silenceAction === 'execute_continue'*/) {

            // send prompt
            onSendPrompt()

            // record again?
            if (userStoppedDictation === false && (props.conversationMode === 'auto'/* || store.config.stt.silenceAction === 'execute_continue'*/)) {
              startDictation()
            }
          
          } else {

            // focus
            input.value.focus()

            // conversation tip
            if (props.enableConversations) {
              tipsManager.showTip('conversation')
            }


          }

        } catch (error) {
          console.error(error)
          Dialog.alert('Error transcribing audio')
        }

        // update
        processing.value = false

      },
    }
  })

  // streaming setup
  const useStreaming = transcriber.requiresStreaming
  if (useStreaming) {
    await transcriber.startStreaming((text) => {
      prompt.value = text
      autoGrow(input.value)
    })
  }

  // start
  dictating.value = true
  audioRecorder.start(transcriber.requiresStreaming)

}

const onConversationMenu = () => {
  if (!props.enableConversations) return
  const icon = document.querySelector('.prompt .dictate')
  const rect = icon?.getBoundingClientRect()
  menuX.value = rect?.left + (props.menusPosition === 'below' ? -10 : 0)
  menuY.value = rect?.height + (props.menusPosition === 'below' ? rect.y : 8 )  + 24
  showConversationMenu.value = true
}

const handleConversationClick = (action: string) => {
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
  emitEvent('audio-noise-detected', null)
  emitEvent('conversation-mode', null)
}

const onDocRepo = async () => {

  if (docRepos.value.length === 0) {
    const result = await Dialog.show({
      title: t('prompt.docRepos.none'),
      showCancelButton: true,
      confirmButtonText: t('common.create'),
    })
    if (result.isConfirmed) {
      window.api.docrepo.open()
    }
    return
  }
  
  showDocRepo.value = true
  const icon = document.querySelector('.prompt .docrepo')
  const rect = icon?.getBoundingClientRect()
  menuX.value = rect?.left
  menuY.value = rect?.height + 32
}

const handleDocRepoClick = (action: string) => {
  closeContextMenu()
  if (action === 'disconnect') {
    if (props.chat) {
      props.chat.docrepo = null
    }
    docrepo.value = null
    window.api.docrepo.disconnect()
  } else {
    window.api.docrepo.connect(action)
    if (props.chat) {
      props.chat.docrepo = action
    } else {
      docrepo.value = action
    }
  }
}

const isContextMenuOpen = () => {
  return showDocRepo.value || showExperts.value || showCommands.value || showActiveExpert.value || showConversationMenu.value
}

const closeContextMenu = () => {
  showDocRepo.value = false
  showExperts.value = false
  showCommands.value = false
  showActiveExpert.value = false
  showConversationMenu.value = false
  nextTick(() => {
    input.value.focus()
  })
}

const handleExpertClick = (action: string) => {
  closeContextMenu()
  if (action === 'clear') {
    disableExpert()
    return
  } else if (action) {
    setExpert(store.experts.find(p => p.id === action))
  }
}

const disableExpert = () => {
  expert.value = null
}

const onCommands = () => {
  showCommands.value = true
  const textarea = document.querySelector('.prompt textarea')
  const rect = textarea?.getBoundingClientRect()
  menuX.value = rect?.right - 250
  menuY.value = rect?.height + 32
}

const handleCommandClick = (action: string) => {
  closeContextMenu()
  const command = store.commands.find(c => c.id === action)
  prompt.value = commandI18n(command, 'template').replace('{input}', prompt.value)
  onSendPrompt()
}

let draftPrompt = ''
const onKeyDown = (event: KeyboardEvent) => {

  if (event.key === 'Enter') {
    if (event.isComposing) return
    if (event.shiftKey) {

    } else {
      onSendPrompt()
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {

    // need an history provider
    if (!props.historyProvider) {
      return
    }

    // get caret position
    const caret = input.value.selectionStart
    const atStart = (caret === 0)
    const atEnd = (caret === prompt.value.length)
    
    // when in the middle, we need shift
    if (!atStart /*&& !atEnd*/ && !event.shiftKey) {
      return
    }

    // get messages
    const history = props.historyProvider(event)
    if (!history?.length) {
      return
    }

    // now navigate
    let newPrompt = null
    const index = history.findIndex((m: string) => m === prompt.value)
    if (event.key === 'ArrowUp') {
      if (index === -1) {
        draftPrompt = prompt.value
        newPrompt = history[history.length - 1]
      } else if (index > 0) {
        newPrompt = history[index - 1]
      } else {
        // keydown moved caret at beginning
        // so move it back to the end
        // const length = prompt.value.length;
        // input.value.setSelectionRange(length, length);
      }
    } else {
      if (index >= 0 && index < history.length - 1) {
        newPrompt = history[index + 1]
      } else if (index != -1) {
        newPrompt = draftPrompt
      }
    }

    // update
    if (newPrompt !== null) {
      prompt.value = newPrompt
      nextTick(() => {
        input.value.setSelectionRange(0, 0)
        autoGrow(input.value)
        // if (input.value.scrollTo) {
        //   // no scrollTo while testing
        //   input.value.scrollTo(0, input.value.scrollHeight)
        // }
      })
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  } else if (event.key === '@') {
    if (prompt.value === '') {
      onClickExperts()
      event.preventDefault()
      prompt.value = '@'
      return false
    }
  } else if (event.key === 'Backspace') {
    if (prompt.value === '') {
      if (++backSpaceHitsWhenEmpty === backSpaceHitsToClearExpert) {
        backSpaceHitsWhenEmpty = 0
        disableExpert()
      }
    } else {
      backSpaceHitsWhenEmpty = 0
    }
  }
}

const onGlobalKeyDown = (event: KeyboardEvent) => {
  const isCommand = !event.shiftKey && !event.altKey && (event.metaKey || event.ctrlKey)
  if (event.key === 't' && isCommand) {
    event.preventDefault()
    event.stopPropagation()
    onDictate()
  }
}

const onKeyUp = (event: KeyboardEvent) => {
  nextTick(() => {
    autoGrow(event.target as HTMLElement)
  })
}

const autoGrow = (element: HTMLElement) => {
  if (element) {
    // reset before calculating
    element.style.height = '0px'
    element.style.height = Math.min(150, element.scrollHeight) + 'px'
    emitEvent('prompt-resize', element.style.height)
  }
}

defineExpose({

  getPrompt: () => {
    return prompt.value
  },

  setPrompt: (message: string|Message) => {
    if (message instanceof Message) {
      onSetPrompt(message)
    } else {
      onSetPrompt(new Message('user', message))
    }
  },

  setExpert,
    
  focus: () => {
    input.value.focus()
  },

  isContextMenuOpen,

})

</script>

<style scoped>

.prompt, .prompt * {
  font-size: 12pt;
}

.prompt {
  padding: 8px 12px;
  display: flex;
  align-items: center;
}

.prompt .icon {
  cursor: pointer;
  color: var(--prompt-icon-color);
}

.prompt .icon.active {
  color: var(--highlight-color);
}

.prompt .icon.dictate.active {
  color: red;
}

.prompt .actions {
  display: flex;
}

.prompt .actions-many .icon {
  padding-left: 4px;
  padding-right: 4px;
}

.prompt .actions-many .icon.attach {
  padding-left: 3px;
  padding-right: 3px;
}

.prompt .actions-many .icon.dictate {
  padding-left: 0px;
  padding-right: 0px;
}

.attachment .icon {
  height: 18pt !important;
  width: 18pt !important;
}

.input {
  background-color: var(--prompt-input-bg-color);
  border: 1px solid var(--prompt-input-border-color);
  border-radius: 16px;
  margin: 0px 8px;
  overflow: hidden;
  flex: 1;
}

.input .attachment {
  margin-top: 4px;
  margin-left: 8px;
  cursor: pointer;
}

.input .textarea-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.input .textarea-wrapper .icon.left {
  margin-left: 16px;
}

.input .textarea-wrapper .icon.left.expert {
  margin-top: 2px;
  margin-right: 4px;
  color: var(--prompt-input-text-color);
  cursor: pointer;
  svg {
    height: 12pt;
  }
}

.input .textarea-wrapper .icon.left:not(:first-of-type).expert {
  margin-left: 4px;
}

.input .textarea-wrapper .icon.left.loader-wrapper {
  margin-left: 4px;
  margin-top: -8px;
  height: 24px;
  display: flex;
  justify-content: center;
  gap: 8px;
  transform: scale(0.5);
  :nth-child(1), :nth-child(3) {
    animation-delay: 250ms;
  }
  .loader {
    background-color: var(--control-placeholder-text-color);
  }
}

.input .textarea-wrapper .icon.right {
  position: absolute;
  border-radius: 16px;
  margin-top: -2px;
  margin-left: 8px;
  right: 12px;
}

.input .textarea-wrapper textarea {
  background-color: var(--prompt-input-bg-color);
  color: var(--prompt-input-text-color);
  border: none;
  resize: none;
  box-sizing: border-box;
  border-radius: 16px;
  overflow-x: hidden;
  overflow-y: auto;
  padding-left: 16px;
  padding-right: 36px;
  padding-top: 5px;
  padding-bottom: 7px;
  width: 100%;
}

.input .textarea-wrapper .icon.left + textarea {
  padding-left: 8px;
}

.input .textarea-wrapper textarea::placeholder {
  color: var(--control-placeholder-text-color);
  opacity: 0.5;
}

.input .textarea-wrapper textarea:focus {
  outline: none;
  flex: 1;
}

.input .textarea-wrapper textarea:disabled {
  color: var(--control-placeholder-text-color);
}

.windows .input, .windows .input .textarea-wrapper textarea {
  border-radius: 0px;
}

.input .attachment img {
  height: 36pt !important;
  width: 36pt !important;
  object-fit: cover;
}

::-webkit-scrollbar {
  height: 1rem;
  width: .5rem;
}

::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-thumb-color);
  border-color: var(--prompt-input-bg-color);
  border-radius: 9999px;
  border-width: 1px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--scrollbar-thumb-color);
}

::-webkit-scrollbar-track {
  background-color: transparent;
  border-radius: 9999px;
}

</style>
