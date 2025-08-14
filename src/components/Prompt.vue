<template>
  <div class="prompt" :class="{ 'drag-over': isDragOver }" @drop="onDrop" @dragover="onDragOver" @dragenter="onDragEnter" @dragleave="onDragLeave">
    <slot name="before" />
    <div class="attachments" v-if="attachments.length > 0">
      <div class="attachment" v-for="(attachment, index) in attachments" :key="index">
        <AttachmentView :attachment="attachment" />
        <div class="title" v-if="!attachment.isImage()">{{ attachment.filenameShort }}</div>
        <BIconXLg class="delete" @click="onDetach(attachment)" />
      </div>
    </div>
    <div class="input" @paste="onPaste">
      <div class="textarea-wrapper">
        <div class="icon left processing loader-wrapper" v-if="isProcessing"><Loader /><Loader /><Loader /></div>
        <div v-if="command" class="icon left command" @click="onClickActiveCommand"><BIconCommand /></div>
        <textarea v-model="prompt" :placeholder="placeholder" @keydown="onKeyDown" @keyup="onKeyUp" ref="input" autofocus="true" :disabled="conversationMode?.length > 0" />
        <BIconMic v-if="hasDictation"
          v-tooltip="{ text: t('prompt.conversation.tooltip'), position: 'top' }"
          :class="{ icon: true, dictate: true, active: dictating }" 
          @click="onDictate" 
          @contextmenu="onConversationMenu" 
        />
        <Waveform v-if="enableWaveform && dictating" :width="64" :height="16" foreground-color-inactive="var(--background-color)" foreground-color-active="red" :audio-recorder="audioRecorder" :is-recording="true"/>
        <BIconMagic class="icon command right" @click="onCommands(true)" v-if="enableCommands && prompt" />
        <BIconStopCircleFill class="icon stop" @click="onStopPrompting" v-if="isPrompting" />
        <BIconSendFill class="icon send" @click="onSendPrompt" v-else />
      </div>
    </div>
    <div class="actions">
      <BIconPlusLg 
        class="icon prompt-menu scale105"
        @click="onPromptMenu"
        ref="promptMenuAnchor"
      />
      
      <PromptFeature
        v-if="instructions"
        :label="instructions.label"
        @clear="clearInstructions"
      />
      
      <PromptFeature
        v-if="expert"
        :icon="BIconMortarboard"
        :label="expert.name || expertI18n(expert, 'name')"
        @clear="clearExpert"
      />
      
      <PromptFeature
        v-if="docrepo"
        :icon="BIconDatabase"
        :label="getActiveDocRepoName()"
        @clear="clearDocRepo"
      />
      
      <PromptFeature
        v-if="deepResearchActive"
        :icon="BIconBinoculars"
        :label="t('common.deepResearch') || 'Deep Research'"
        @clear="clearDeepResearch"
      />
      
      <slot name="actions" />
    </div>
    <slot name="between" />
    <slot name="after" />
    <ContextMenu v-if="showCommands" @close="closeContextMenu" :show-filter="true" :actions="commands" @action-clicked="handleCommandClick" :x="menuX" :y="menuY" :position="menusPosition" />
    <ContextMenu v-if="showConversationMenu" @close="closeContextMenu" :actions="conversationMenu" @action-clicked="handleConversationClick" :x="menuX" :y="menuY" :position="menusPosition" />
    <PromptMenu
      v-if="showPromptMenu"
      anchor=".prompt-menu"
      :position="menusPosition"
      :enable-experts="enableExperts"
      :enable-doc-repo="enableDocRepo" 
      :enable-instructions="enableInstructions"
      :enable-attachments="enableAttachments"
      :enable-deep-research="enableDeepResearch"
      :current-expert="expert"
      :active-doc-repo="props.chat?.docrepo || docrepo"
      :current-instructions="instructions"
      :deep-research-active="deepResearchActive"
      :workspace-id="store.config.workspaceId"
      :engine="engine()"
      :model="model()"
      @close="closePromptMenu"
      @expert-selected="handleExpertClick"
      @doc-repo-selected="handlePromptMenuDocRepo"
      @manage-doc-repo="handleManageDocRepo"
      @instructions-selected="handlePromptMenuInstructions"
      @attach-requested="onAttach"
      @deep-research-toggled="onDeepResearch"
    />
  </div>
</template>

<script setup lang="ts">

import { Expert, Command, CustomInstruction } from '../types/index'
import { DocumentBase } from '../types/rag'
import { StreamingChunk } from '../voice/stt'
import { ref, computed, onMounted, onUnmounted, nextTick, watch, PropType } from 'vue'
import { store } from '../services/store'
import { expertI18n, commandI18n, t, i18nInstructions, getLlmLocale, setLlmLocale } from '../services/i18n'
import { BIconPlusLg, BIconMortarboard, BIconDatabase, BIconTerminal, BIconBinoculars } from 'bootstrap-icons-vue'
import LlmFactory, { ILlmManager } from '../llms/llm'
import { mimeTypeToExtension, extensionToMimeType } from 'multi-llm-ts'
import useAudioRecorder, { isAudioRecordingSupported } from '../composables/audio_recorder'
import ContextMenu, { MenuPosition } from './ContextMenu.vue'
import PromptMenu from './PromptMenu.vue'
import PromptFeature from './PromptFeature.vue'
import useTipsManager from '../composables/tips_manager'
import useTranscriber from '../composables/transcriber'
import ImageUtils from '../composables/image_utils'
import Waveform from '../components/Waveform.vue'
import AttachmentView from './Attachment.vue'
import Attachment from '../models/attachment'
import Dialog from '../composables/dialog'
import Message from '../models/message'
import Loader from './Loader.vue'
import Chat from '../models/chat'

export type SendPromptParams = {
  prompt: string,
  instructions?: string,
  attachments?: Attachment[]
  docrepo?: string,
  expert?: Expert,
  deepResearch?: boolean
}

export type RunAgentParams = {
  agentId: string,
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
  enableInstructions: {
    type: Boolean,
    default: true
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
    type: String as PropType<MenuPosition>,
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
  enableWaveform: {
    type: Boolean,
    default: true
  },
  enableDeepResearch: {
    type: Boolean,
    default: false
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
const { transcriber, processStreamingError } = useTranscriber(store.config)
const tipsManager = useTipsManager(store)
const llmManager: ILlmManager = LlmFactory.manager(store.config)
let userStoppedDictation = false

const prompt = ref('')
const instructions = ref<CustomInstruction>(undefined)
const expert = ref<Expert>(undefined)
const command = ref<Command>(undefined)
const attachments = ref<Attachment[]>([])
const docrepo = ref<string>(undefined)
const input = ref<HTMLTextAreaElement>(null)
const docRepos = ref<DocumentBase[]>([])
const showExperts = ref(false)
const showCommands = ref(false)
const showConversationMenu = ref(false)
const showPromptMenu = ref(false)
const deepResearchActive = ref(false)
const hasDictation = ref(false)
const dictating = ref(false)
const processing = ref(false)
const isDragOver = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const emit = defineEmits(['prompt', 'run-agent','stop'])

const engine = () => props.chat?.engine || llmManager.getChatEngineModel().engine
const model = () => props.chat?.model || llmManager.getChatEngineModel().model

const backSpaceHitsToClearExpert = 1
let backSpaceHitsWhenEmpty = 0
let runCommandImmediate = false

const isProcessing = computed(() => {
  return processing.value || props.processing
})

const isPrompting = computed(() => {
  return props.chat?.lastMessage()?.transient
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

  // event
  onEvent('set-prompt', onSetPrompt)
  window.api.on('docrepo-modified', loadDocRepos)
  autoGrow(input.value)

  // other stuff
  loadDocRepos()
  initDictation()

  // reset doc repo and expert
  watch(() => props.chat || {}, () => {
    docrepo.value = matchDocRepo(props.chat?.docrepo)
    instructions.value = matchInstructions(props.chat?.instructions)
  }, { immediate: true })

})

onUnmounted(() => {
  window.api.off('docrepo-modified', loadDocRepos)
})

const matchInstructions = (instructions?: string): CustomInstruction|null => {

  // if no text
  if (!instructions) {
    return null
  }

  // First, check if it matches a custom instruction
  const customInstructions = store.config.llm.customInstructions || []
  for (const custom of customInstructions) {
    if (custom.instructions === instructions) {
      return {
        id: custom.id,
        label: custom.label,
        instructions: custom.instructions
      }
    }
  }

  // Second, check if it matches a standard instruction
  const instructionIds = ['standard', 'structured', 'playful', 'empathic', 'uplifting', 'reflective', 'visionary']
  for (const instructionId of instructionIds) {
    const standardInstructions = i18nInstructions(store.config, `instructions.chat.${instructionId}`)
    if (standardInstructions === instructions) {
      return {
        id: instructionId,
        label: t(`settings.llm.instructions.${instructionId}`) || instructionId,
        instructions: instructions
      }
    }
  }

  // Default: return as custom instruction if no match found
  return {
    id: 'custom',
    label: 'Custom',
    instructions: instructions
  }
}

const matchDocRepo = (docRepoId?: string): string | undefined => {
  if (!docRepoId) return undefined
  const exists = docRepos.value.some(repo => repo.uuid === docRepoId)
  return exists ? docRepoId : undefined
}

const defaultPrompt = (conversationMode: string) => {
  if (conversationMode === 'auto') {
    return t('prompt.conversation.placeholders.auto')
  } else if (conversationMode === 'ptt') {
    return t('prompt.conversation.placeholders.ptt')
  } else {
    return ''
  }
}

const onDeepResearch = () => {
  deepResearchActive.value = !deepResearchActive.value
}

const setDeepResearch = (active: boolean) => {
  deepResearchActive.value = active
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
    docRepos.value = window.api.docrepo.list(store.config.workspaceId)
  }
}


const onSetPrompt = (message: Message) => {
  prompt.value = message.content
  attachments.value = message.attachments
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
  if (command.value) {
    message = commandI18n(command.value, 'template').replace('{input}', message)
    command.value = null
  }
  prompt.value = defaultPrompt(props.conversationMode)
  nextTick(() => {
    autoGrow(input.value)
    emit('prompt', {
      instructions: instructions.value?.instructions,
      prompt: message,
      attachments: attachments.value,
      docrepo: docrepo.value,
      expert: expert.value,
      deepResearch: deepResearchActive.value,
    } as SendPromptParams)
    attachments.value = []
  })
}

const onStopPrompting = () => {
  emit('stop', null)
}

const onAttach = async () => {

  await closePromptMenu()
  
  let files = window.api.file.pickFile({ multiselection: true, /*filters: [
    { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
  ]*/ })
  if (Array.isArray(files)) {
    for (const filepath of files) {
      const fileContents = window.api.file.read(filepath)
      const format = fileContents.url.split('.').pop()
      if (llmManager.canProcessFormat(engine(), model(), format)) {
        const mimeType = extensionToMimeType(format)
        attach(fileContents.contents, mimeType, fileContents.url)
      } else {
        console.error('Cannot attach format', format)
        Dialog.alert(`${fileContents.url.split('/').pop()}: ${t('prompt.attachment.formatError.title')}`, t('prompt.attachment.formatError.text'))
      }
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
            Dialog.alert(t('prompt.attachment.formatError.title'), t('prompt.attachment.formatError.text'))
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
        attachments.value.push(new Attachment(resizedContent, resizedMimeTyoe, url))
      })
    } catch (e) {
      console.error('Error resizing image', e)
      attachments.value.push(toAttach)
    }
  } else if (toAttach.isText()) {
    toAttach.loadContents()
    if (!toAttach.content) {
      Dialog.alert(`${url.split('/').pop()}: ${t('prompt.attachment.emptyError.title')}`, t('prompt.attachment.emptyError.text'))
      return
    } else {
      attachments.value.push(toAttach)
    }
  } else {
    attachments.value.push(toAttach)
  }
}

const onDetach = (attachment: Attachment) => {
  attachments.value = attachments.value.filter((a: Attachment) => a !== attachment)
}

const onDragOver = (event: DragEvent) => {
  if (!props.enableAttachments) return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
}

const onDragEnter = (event: DragEvent) => {
  if (!props.enableAttachments) return
  event.preventDefault()
  isDragOver.value = true
}

const onDragLeave = (event: DragEvent) => {
  if (!props.enableAttachments) return
  event.preventDefault()
  // Only set to false if we're leaving the dropzone itself, not a child element
  if (!(event.currentTarget as HTMLElement)?.contains(event.relatedTarget as Node)) {
    // for a very strange reason, when dragging over the textarea, the relatedTarget is a div with no parent and no children
    const relatedTarget = event.relatedTarget as HTMLElement
    if (relatedTarget && relatedTarget.nodeName === 'DIV' && relatedTarget.parentElement === null && relatedTarget.children.length === 0) {
      return
    }
    isDragOver.value = false
  }
}

const onDrop = async (event: DragEvent) => {
  if (!props.enableAttachments) return
  event.preventDefault()
  isDragOver.value = false
  
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return
  
  // Process all dropped files
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    try {
      // Check if the format is supported by the LLM
      const format = file.name.split('.').pop()?.toLowerCase()
      if (!format || !llmManager.canProcessFormat(engine(), model(), format)) {
        console.error('Cannot attach format', format)
        Dialog.alert(`${file.name}: ${t('prompt.attachment.formatError.title')}`, t('prompt.attachment.formatError.text'))
        continue
      }
      
      // Read the file as base64
      const reader = new FileReader()
      
      reader.onload = async (event) => {
        if (event.target?.readyState === FileReader.DONE) {
          const result = event.target.result as string
          
          // Extract mime type and base64 content
          const mimeType = result.split(';')[0].split(':')[1]
          const contents = result.split(',')[1]
          
          // Create the file URL for display
          const url = `file://${file.name}`
          
          // Call the existing attach function
          await attach(contents, mimeType, url)
        }
      }
      
      reader.onerror = () => {
        console.error('Error reading file:', file.name)
        Dialog.alert(`${file.name}: Error reading file`)
      }
      
      // Read the file as data URL (base64)
      reader.readAsDataURL(file)
      
    } catch (error) {
      console.error('Error processing dropped file:', error)
      Dialog.alert(`${file.name}: Error processing file`)
    }
  }
}


const openExperts = () => {
  const icon = document.querySelector('.prompt .experts')
  const rect = icon?.getBoundingClientRect()
  menuX.value = rect?.left + (props.menusPosition === 'below' ? -10 : 0)
  menuY.value = rect?.height + (props.menusPosition === 'below' ? rect?.y : 16 )  + 24
  showExperts.value = true
}

const onClickExperts = () => {
  openExperts()
}


const onClickActiveCommand = () => {
  disableCommand()
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
            await nextTick()
            autoGrow(input.value)

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
  let connected = true
  const useStreaming = transcriber.requiresStreaming
  if (useStreaming) {
    await transcriber.startStreaming(async (chunk: StreamingChunk) => {
      if (chunk.type === 'text') {
        prompt.value = chunk.content
        autoGrow(input.value)
      } else if (chunk.type === 'error') {
        await processStreamingError(chunk)
        dictating.value = false
        audioRecorder.stop()
        connected = false
      }
    })
  }

  // check
  if (!connected) {
    return
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



const isContextMenuOpen = () => {
  return showExperts.value || showCommands.value || showConversationMenu.value || showPromptMenu.value
}

const closeContextMenu = () => {
  showExperts.value = false
  showCommands.value = false
  showConversationMenu.value = false
  showPromptMenu.value = false
  nextTick(() => {
    input.value.focus()
  })
}

const onPromptMenu = () => {
  closeContextMenu()
  showPromptMenu.value = true
}

const closePromptMenu = async () => {
  showPromptMenu.value = false
  await nextTick()
  input.value.focus()
}

const handlePromptMenuDocRepo = (docRepoUuid: string) => {
  setDocRepo(docRepoUuid)
  closePromptMenu()
}

const handlePromptMenuDocRepoDisconnect = () => {
  setDocRepo(null)
  closePromptMenu()
}

const handleManageDocRepo = () => {
  window.api.docrepo.open()
  closePromptMenu()
}

const setDocRepo = (docRepoUuid: string | null) => {
  if (docRepoUuid) {
    window.api.docrepo.connect(docRepoUuid)
    docrepo.value = docRepoUuid
    if (props.chat) {
      props.chat.docrepo = docRepoUuid
    }
  } else {
    window.api.docrepo.disconnect()
    docrepo.value = null
    if (props.chat) {
      props.chat.docrepo = null
    }
  }
}

const handlePromptMenuInstructions = (instructionId: string) => {

  if (instructionId === 'null') {

    instructions.value = null


  } else if (instructionId.startsWith('custom:')) {

    // Handle custom instructions
    const customId = instructionId.replace('custom:', '')
    const customInstruction = store.config.llm.customInstructions?.find(c => c.id === customId)
    if (customInstruction) {
      instructions.value = {
        id: customInstruction.id,
        label: customInstruction.label,
        instructions: customInstruction.instructions
      }
    }
  } else {

    // Handle default instructions
    // use chat llm locale if set
    let llmLocale = null
    const forceLocale = store.config.llm.forceLocale
    if (props.chat?.locale) {
      llmLocale = getLlmLocale()
      setLlmLocale(props.chat.locale)
      store.config.llm.forceLocale = true
    }

    // get the instructions
    instructions.value = {
      id: instructionId,
      label: t(`settings.llm.instructions.${instructionId}`) || instructionId,
      instructions: i18nInstructions(store.config, `instructions.chat.${instructionId}`)
    }

    // restore
    if (llmLocale) {
      setLlmLocale(llmLocale)
      store.config.llm.forceLocale = forceLocale
    }
  }
  if (props.chat) {
    props.chat.instructions = instructions.value?.instructions
  }
  closePromptMenu()
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

const disableCommand = () => {
  command.value = null
}

const onCommands = (immediate: boolean) => {
  showCommands.value = true
  runCommandImmediate = immediate
  const textarea = document.querySelector('.prompt textarea')
  const rect = textarea?.getBoundingClientRect()
  menuX.value = rect?.right + (props.menusPosition === 'below' ? rect?.y - 150 : 0 ) - 250
  menuY.value = rect?.height + (props.menusPosition === 'below' ? rect?.y + 24 : 0 ) + 32
}

const handleCommandClick = (action: string) => {
  closeContextMenu()
  command.value = store.commands.find(c => c.id === action)
  if (prompt.value.endsWith('#')) {
    prompt.value = prompt.value.slice(0, -1)
  }
  if (runCommandImmediate) {
    onSendPrompt()
  }
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

    // not if context menu is open
    if (isContextMenuOpen()) {
      return
    }

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
    if (props.enableExperts && prompt.value === '') {
      onClickExperts()
      event.preventDefault()
      prompt.value = '@'
      return false
    }
  } else if (event.key === '#') {
    if (props.enableCommands && prompt.value === '') {
      onCommands(false)
      prompt.value = '#'
      event.preventDefault()
      return false
    }
  } else if (event.key === 'Backspace') {
    if (prompt.value === '') {
      if (++backSpaceHitsWhenEmpty === backSpaceHitsToClearExpert) {
        backSpaceHitsWhenEmpty = 0
        disableExpert()
        disableCommand()
      }
    } else {
      backSpaceHitsWhenEmpty = 0
    }
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

// Feature management methods
const clearExpert = () => {
  expert.value = null
}

const clearDocRepo = () => {
  setDocRepo(null)
}

const clearInstructions = () => {
  instructions.value = null
}

const clearDeepResearch = () => {
  deepResearchActive.value = false
}

const getActiveDocRepoName = () => {
  const activeUuid = docrepo.value || props.chat?.docrepo
  const activeDoc = docRepos.value.find(doc => doc.uuid === activeUuid)
  return activeDoc?.name || 'Knowledge Base'
}

defineExpose({

  getPrompt: () => prompt.value,
  focus: () => input.value.focus(),

  setExpert,
  setDeepResearch,
  isContextMenuOpen,
  startDictation: onDictate,

  isDeepResearchActive: () => deepResearchActive.value,

  setPrompt: (message: string|Message) => {
    if (message instanceof Message) {
      onSetPrompt(message)
    } else {
      onSetPrompt(new Message('user', message))
    }
  },

  attach: (toAttach: Attachment[]) => {
    for (const attachment of toAttach) {
      attachments.value.push(attachment)
    }
  },

  sendPrompt: () => {
    onSendPrompt()
  },

})

</script>

<style scoped>

.prompt, .prompt * {
  font-size: 12pt;
}

.prompt {
  
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border: 1px solid var(--prompt-input-border-color);
  border-radius: 1rem;
  background-color: var(--prompt-input-bg-color);

  &.drag-over {
    border: 1px dashed var(--highlight-color);
  }

  .icon {
    cursor: pointer;
    color: var(--prompt-icon-color);

    &.active {
      fill: var(--highlight-color);
      color: var(--highlight-color);
    }

    &.dictate.active {
      color: red;
    }

  }

  .attachments {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-bottom: 0.5rem;
    gap: 0.5rem;

    .attachment {
      
      padding: 0.5rem 0.25rem;
      border: 1px solid var(--prompt-input-border-color);
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;

      &:has(img) {
        padding: 0.125rem 0.25rem;
      }

      .icon {
        height: 1.25rem !important;
        width: 1.25rem !important;
      }

      img {
        height: 2rem !important;
        width: 2rem !important;
        border-radius: 0.125rem;
        object-fit: cover;
      }

      .title {
        font-size: 0.9rem;
        opacity: 0.8;
      }

      .delete {
        padding-left: 0.25rem;
        cursor: pointer;
      }

    }
  }

  .input {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: row;

    .textarea-wrapper {
      flex: 1;
      display: flex;
      flex-direction: row;
      gap: 0.5rem;
      align-items: center;
      overflow: hidden;

      .icon.left {
        color: var(--control-placeholder-text-color);
      }

      .icon.left:first-child {
        margin-left: 0.25rem;
      }

      .icon.left.expert {
        position: relative;
        top: 2px;
        cursor: pointer;
        svg {
          height: 12pt;
        }
      }

      .icon.left.command {
        position: relative;
        top: 2px;
        transform: scale(0.9);
      }

      .icon.left.loader-wrapper {
        position: relative;
        top: -4px;
        margin-left: 0;
        margin-right: -8px;
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

      textarea {
        background-color: var(--prompt-input-bg-color);
        color: var(--prompt-input-text-color);
        border: none;
        resize: none;
        box-sizing: border-box;
        border-radius: 16px;
        overflow-x: hidden;
        overflow-y: auto;
        width: 100%;
      }

      .icon.left + textarea {
        padding-left: 0px;
      }

      textarea::placeholder {
        color: var(--control-placeholder-text-color);
        opacity: 0.5;
      }

      textarea:focus {
        outline: none;
        flex: 1;
      }

      textarea:disabled {
        color: var(--control-placeholder-text-color);
      }

    }

  }

  .actions {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.25rem;
    margin-left: 0.25rem;
    align-items: center;

    &:not(:has(*)) {
      display: none;
    }
    
    .icon {
      width: 1rem;
      height: 1rem;
    }

    .icon.instructions {
      transform: scaleY(110%);
      margin-top: 1px;
      margin-right: 4px;
    }

    .icon.experts {
      padding-left: 2px;
      padding-right: 2px;
      transform: scaleY(1.05);
    }

    .icon.dictate {
      margin-left: -2px;
    }

    .icon.research {
      margin: 0 0.25rem;
      width: auto;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.25rem;
      span {
        font-size: 0.95em;
      }
    }

  }

}

.windows .input, .windows .input .textarea-wrapper textarea {
  border-radius: 0px;
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
