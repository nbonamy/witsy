<template>
  <div class="prompt" :class="{ 'drag-over': isDragOver }" @drop="onDrop" @dragover="onDragOver" @dragenter="onDragEnter" @dragleave="onDragLeave">
    <slot name="before" />
    <div class="attachments" v-if="attachments.length > 0">
      <div class="attachment" v-for="(attachment, index) in attachments" :key="index">
        <AttachmentView :attachment="attachment" />
        <div class="title" v-if="!attachment.isImage()">{{ attachment.filenameShort }}</div>
        <XIcon class="delete" @click="onDetach(attachment)" />
      </div>
    </div>
    <div class="input" @paste="onPaste">
      <div class="textarea-wrapper">
        <div class="icon left processing loader-wrapper" v-if="isProcessing"><Loader /><Loader /><Loader /></div>
        <div v-if="command" class="icon left command" @click="onClickActiveCommand"><CommandIcon /></div>
        <textarea v-model="prompt" :placeholder="placeholder" @keydown="onKeyDown" @keyup="onKeyUp" @paste="onKeyUp" ref="input" autofocus="true" :disabled="conversationMode !== 'off'" />
      </div>
    </div>
    <div class="actions">
      
      <ButtonIcon class="prompt-menu" :id="`prompt-menu-${uniqueId}`" @click="onPromptMenu" ref="promptMenuAnchor">
        <PlusIcon class="icon" />
      </ButtonIcon>
      
      <PromptFeature
        v-if="instructions"
        :icon="FeatherIcon"
        :label="instructions.label"
        @clear="clearInstructions"
      />
      
      <PromptFeature
        v-if="expert"
        :icon="BrainIcon"
        :label="expert.name || expertI18n(expert, 'name')"
        @clear="clearExpert"
      />
      
      <PromptFeature
        v-for="uuid in docrepos"
        :key="uuid"
        :icon="LightbulbIcon"
        :label="getDocRepoName(uuid)"
        @clear="removeDocRepo(uuid)"
      />
      
      <PromptFeature
        v-if="deepResearchActive"
        :icon="TelescopeIcon"
        :label="t('common.deepResearch') || 'Deep Research'"
        @clear="clearDeepResearch"
      />

      <div class="flex-push"></div>
      
      <slot name="actions" />
      
      <ButtonIcon :id="`commands-menu-${uniqueId}`" @click="onCommands()" v-if="enableCommands && prompt && store.isFeatureEnabled('chat.commands')">
        <CommandIcon class="icon command" />
      </ButtonIcon>
      
      <Waveform v-if="enableWaveform && dictating" :width="64" :height="16" foreground-color-inactive="var(--background-color)" foreground-color-active="red" :audio-recorder="audioRecorder" :is-recording="true"/>
      
      <ButtonIcon :id="`dictate-${uniqueId}`" @click="onDictate" @contextmenu="onConversationMenu" v-if="hasDictation">
        <MicIcon
          v-tooltip="{ text: t('prompt.conversation.tooltip'), position: 'top' }"
          :class="{ icon: true, dictate: true, active: dictating }"
        />
      </ButtonIcon>
      
      <div class="model-menu-button" :id="`model-menu-button-${uniqueId}`" @click="onModelMenu">
        <BoxIcon />
        <div class="model-name">{{ modelName }}</div>
        <ChevronDownIcon class="icon caret" />
      </div>

      <template v-if="store.isFeatureEnabled('favorites') && chat">

        <ButtonIcon name="addToFavorites" v-if="!isFavoriteModel" @click="addToFavorites" v-tooltip="{ text: t('common.favorites.add'), position: 'top' }">
          <HeartPlusIcon class="icon add-favorite" />
        </ButtonIcon>

        <ButtonIcon name="removeFavorite" v-else @click="removeFavorite" v-tooltip="{ text: t('common.favorites.remove'), position: 'top' }">
          <HeartMinusIcon class="icon remove-favorite" />
        </ButtonIcon>

      </template>

      <ButtonIcon class="send-stop" @click="(promptingState !== 'idle' || isGenerating) ? onStopPrompting() : onSendPrompt()">
        <XIcon class="icon stop" :class="{ canceling: promptingState === 'canceling' }" v-if="promptingState !== 'idle' || isGenerating" />
        <ArrowUpIcon class="icon send" :class="{ disabled: !prompt.length }" v-else />
      </ButtonIcon>

    </div>
    
    <slot name="between" />
    <slot name="after" />

    <ContextMenuPlus v-if="showExperts" @close="closeContextMenu" :show-filter="true" anchor=".prompt .textarea-wrapper" :position="menusPosition">

      <!-- Categories with experts -->
      <div v-for="cat in categoriesWithExperts" :key="cat.id" class="item" :data-submenu-slot="`category-${cat.id}`">
        <FolderIcon class="icon" />
        <span>{{ cat.name }}</span>
      </div>

      <!-- Uncategorized experts -->
      <template v-if="uncategorizedExperts.length">
        <div v-for="exp in uncategorizedExperts" :key="exp.id" @click="handleExpertClick(exp.id)">
          <BrainIcon class="icon" />
          <span>{{ exp.name }}</span>
        </div>
      </template>

      <!-- Category submenus -->
      <template v-for="cat in categoriesWithExperts" :key="`submenu-${cat.id}`" #[`category-${cat.id}`]>
        <div v-for="exp in expertsByCategory[cat.id]" :key="exp.id" class="item" @click="handleExpertClick(exp.id)">
          <BrainIcon class="icon" />
          {{ exp.name }}
        </div>
      </template>

      <!-- <div class="separator" />
      <div class="item" @click="handleExpertClick('none')">
        <XIcon class="icon" />
        {{ t('prompt.menu.experts.none') }}
      </div> -->

    </ContextMenuPlus>

    <ContextMenuPlus v-if="showCommands" @close="closeContextMenu" :show-filter="true" :anchor="commandsAnchor" :position="menusPosition">
      <div v-for="cmd in commands" :key="cmd.action" class="item" @click="handleCommandClick(cmd.action)">
        <span v-if="typeof cmd.icon === 'string'" class="icon text">{{ cmd.icon }}</span>
        <component :is="cmd.icon" v-else-if="typeof cmd.icon === 'object'" class="icon" />
        {{ cmd.label }}
      </div>
    </ContextMenuPlus>

    <ContextMenuPlus v-if="showConversationMenu" @close="closeContextMenu" :anchor="`#dictate-${uniqueId}`" :position="menusPosition">
      <div v-for="item in conversationMenu" :key="item.action" class="item" @click="handleConversationClick(item.action)">
        {{ item.label }}
      </div>
    </ContextMenuPlus>

    <PromptMenu
      v-if="showPromptMenu"
      :anchor="`#prompt-menu-${uniqueId}`"
      :position="menusPosition"
      :enable-tools="enableTools"
      :enable-experts="enableExperts"
      :enable-doc-repo="enableDocRepo"
      :enable-instructions="enableInstructions"
      :enable-attachments="enableAttachments"
      :enable-deep-research="enableDeepResearch"
      :tool-selection="chat.tools"
      :selected-doc-repos="docrepos"
      @close="closePromptMenu"
      @expert-selected="handleExpertClick"
      @manage-experts="handleManageExperts"
      @doc-repos-changed="handleDocReposChanged"
      @manage-doc-repo="handleManageDocRepo"
      @instructions-selected="handlePromptMenuInstructions"
      @select-all-tools="handleSelectAllTools"
      @unselect-all-tools="handleUnselectAllTools"
      @select-all-plugins="handleSelectAllPlugins"
      @unselect-all-plugins="handleUnselectAllPlugins"
      @all-plugins-toggle="handleAllPluginsToggle"
      @plugin-toggle="handlePluginToggle"
      @select-all-server-tools="handleSelectAllServerTools"
      @unselect-all-server-tools="handleUnselectAllServerTools"
      @all-server-tools-toggle="handleAllServerToolsToggle"
      @server-tool-toggle="handleServerToolToggle"
      @attach-requested="onAttach"
      @deep-research-toggled="onDeepResearch"
    />
    
    <EngineModelMenu
      v-if="showModelMenu"
      :anchor="`#model-menu-button-${uniqueId}`"
      :position="menusPosition === 'above' ? 'above-right' : 'below-right'"
      @close="closeModelMenu"
      @empty="onNoEngineAvailable"
      @model-selected="handleModelSelected"
    />
  </div>
</template>

<script setup lang="ts">

import Waveform from '@components/Waveform.vue'
import useEventBus from '@composables/event_bus'
import useEventListener from '@composables/event_listener'
import useIpcListener from '@composables/ipc_listener'
import Attachment from '@models/attachment'
import Chat from '@models/chat'
import Message from '@models/message'
import Dialog from '@renderer/utils/dialog'
import ImageUtils from '@renderer/utils/image_utils'
import useTipsManager from '@renderer/utils/tips_manager'
import * as ts from '@renderer/utils/tool_selection'
import { categoryI18n, commandI18n, expertI18n, getLlmLocale, i18nInstructions, setLlmLocale, t } from '@services/i18n'
import LlmFactory, { favoriteMockEngine, ILlmManager } from '@services/llms/llm'
import { store } from '@services/store'
import { ArrowUpIcon, BoxIcon, BrainIcon, ChevronDownIcon, CommandIcon, FeatherIcon, FolderIcon, HeartMinusIcon, HeartPlusIcon, LightbulbIcon, MicIcon, PlusIcon, TelescopeIcon, XIcon } from 'lucide-vue-next'
import { extensionToMimeType, mimeTypeToExtension } from 'multi-llm-ts'
import { Command, CustomInstruction, Expert, MessageExecutionMode } from 'types/index'
import { McpServerWithTools, McpTool } from 'types/mcp'
import { DocumentBase } from 'types/rag'
import { computed, nextTick, onMounted, PropType, ref, watch } from 'vue'
import useAudioRecorder from '../audio/audio_recorder'
import useTranscriber from '../audio/transcriber'
import { isSTTReady, StreamingChunk } from '../voice/stt'
import AttachmentView from './Attachment.vue'
import ButtonIcon from './ButtonIcon.vue'
import ContextMenuPlus, { MenuPosition } from './ContextMenuPlus.vue'
import EngineModelMenu from './EngineModelMenu.vue'
import Loader from './Loader.vue'
import PromptFeature from './PromptFeature.vue'
import PromptMenu from './PromptMenu.vue'

export type SendPromptParams = {
  prompt: string,
  instructions?: string,
  attachments?: Attachment[]
  docrepos?: string[],
  expert?: Expert,
  execMode?: MessageExecutionMode
}

export type RunAgentParams = {
  agentId: string,
}

export type ConversationMode = 'off' | 'auto' | 'ptt'

export type HistoryProvider = (event: KeyboardEvent) => string[]

const { emitBusEvent } = useEventBus()
const { onDomEvent, offDomEvent } = useEventListener()
const { onIpcEvent } = useIpcListener()

const props = defineProps({
  chat: {
    type: Object as PropType<Chat>,
    required: false
  },
  conversationMode: {
    type: String as PropType<ConversationMode>,
    required: false,
    default: 'off'
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
  enableTools: {
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
  isGenerating: {
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

// Generate unique ID for this prompt instance to avoid conflicts when multiple prompts are in DOM
const uniqueId = ref(crypto.randomUUID())

const prompt = ref('')
const instructions = ref<CustomInstruction>(undefined)
const expert = ref<Expert>(undefined)
const command = ref<Command>(undefined)
const attachments = ref<Attachment[]>([])
const docrepos = ref<string[]>([])
const input = ref<HTMLTextAreaElement>(null)
const docRepos = ref<DocumentBase[]>([])
const showExperts = ref(false)
const showCommands = ref(false)
const showConversationMenu = ref(false)
const showPromptMenu = ref(false)
const showModelMenu = ref(false)
const deepResearchActive = ref(false)
const dictating = ref(false)
const processing = ref(false)
const isDragOver = ref(false)
const commandsAnchor = ref('.prompt .textarea-wrapper')

const emit = defineEmits([
  'set-engine-model', 'tools-updated',
  'prompt', 'run-agent', 'stop',
  'conversation-mode'
])

const engine = () => props.chat?.engine || llmManager.getChatEngineModel().engine
const model = () => props.chat?.model || llmManager.getChatEngineModel().model

const backSpaceHitsToClearExpert = 1
let backSpaceHitsWhenEmpty = 0
let runCommandImmediate = false

const hasDictation = computed(() => {
  if (!props.enableDictation) return false
  return isSTTReady(store.config)
})

const isProcessing = computed(() => {
  return processing.value || props.processing
})

type PromptingState = 'idle' | 'prompting' | 'canceling'
const promptingState = ref<PromptingState>('idle')

// Watch for changes in message transient state
watch(() => props.chat?.lastMessage()?.transient, (isTransient) => {
  if (isTransient && promptingState.value === 'idle') {
    promptingState.value = 'prompting'
  } else if (!isTransient && promptingState.value !== 'idle') {
    promptingState.value = 'idle'
  }
})

const expertsMenuItems = computed(() => {
  return store.experts
    .filter((e) => e.state === 'enabled')
    .map(e => ({
      id: e.id,
      name: e.name || expertI18n(e, 'name'),
      categoryId: e.categoryId
    }))
})

const categoriesWithExperts = computed(() => {
  // Get categories that have at least one enabled expert
  const catIds = new Set<string>()
  expertsMenuItems.value.forEach(exp => {
    if (exp.categoryId) catIds.add(exp.categoryId)
  })

  // Get category objects and add labels
  const categories = store.expertCategories
    .filter(c => c.state === 'enabled' && catIds.has(c.id))
    .map(c => ({
      id: c.id,
      icon: c.icon,
      name: categoryI18n(c, 'name')
    }))

  // Sort alphabetically by name
  return categories.sort((a, b) => a.name.localeCompare(b.name))
})

const expertsByCategory = computed(() => {
  const grouped: Record<string, typeof expertsMenuItems.value> = {}

  expertsMenuItems.value.forEach(exp => {
    const catId = exp.categoryId || 'uncategorized'
    if (!grouped[catId]) grouped[catId] = []
    grouped[catId].push(exp)
  })

  // Keep experts in original order (from store.experts)
  return grouped
})

const uncategorizedExperts = computed(() => {
  return expertsMenuItems.value.filter(exp => !exp.categoryId)
})

const commands = computed(() => {
  return store.commands.filter((c) => c.state == 'enabled').map(c => {
    return { label: c.label ?? commandI18n(c, 'label'), action: c.id, icon: c.icon }
  })
})

const conversationMenu = computed(() => {
  if (props.conversationMode !== 'off') {
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

const modelName = computed(() => {
  const model = llmManager.getChatModel(props.chat?.engine, props.chat?.model)
  return model?.name || props.chat?.model || 'Select Model'
})

const isFavoriteModel = computed(() => llmManager.isFavoriteModel(props.chat?.engine, props.chat?.model))

// Escape key to abort generation (document-level)
const onEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && (promptingState.value === 'prompting' || props.isGenerating)) {
    onStopPrompting()
    event.preventDefault()
    event.stopPropagation()
  }
}

onMounted(() => {

  // event
  onIpcEvent('docrepo-modified', loadDocRepos)
  onDomEvent(document, 'keydown', onShortcutDown)
  onDomEvent(document, 'keydown', onEscapeKey)
  autoGrow(input.value)

  // other stuff
  loadDocRepos()
  initDictation()

  // reset doc repo and expert
  watch(() => props.chat || {}, () => {
    docrepos.value = matchDocRepos(props.chat?.docrepos)
    instructions.value = matchInstructions(props.chat?.instructions)
  }, { immediate: true })

})

const onShortcutDown = (ev: KeyboardEvent) => {
  const favorites = llmManager.getChatModels(favoriteMockEngine)
  if (!favorites.length) return
  if (!ev.altKey) return
  let index = ev.keyCode - 49
  if (index === -1) index = 9
  if (index < 0 || index > favorites.length-1) return
  llmManager.setChatModel(favoriteMockEngine, favorites[index].id)
}

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

const matchDocRepos = (docRepoIds?: string[]): string[] => {
  if (!docRepoIds?.length) return []
  return docRepoIds.filter(id => docRepos.value.some(repo => repo.uuid === id))
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

const onKeyUpPTT = (event: Event) => {
  if (hasDictation.value === false) return
  //console.log('Stopping push-to-talk dictation')
  offDomEvent(document, 'keyup', onKeyUpPTT)
  stopDictation(false)
}

const onKeyDownPTT = (event: Event) => {
  const keyEvent = event as KeyboardEvent
  if (hasDictation.value === false) return
  if (props.conversationMode == 'ptt' && keyEvent.code === 'Space' && dictating.value === false) {
    //console.log('Starting push-to-talk dictation')
    onDomEvent(document, 'keyup', onKeyUpPTT)
    startDictation()
  }
}

const initDictation = async () => {
  // push-to-talk stuff
  onDomEvent(document, 'keydown', onKeyDownPTT)
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
  
  // Switch engine and model if expert has them defined
  if (xpert?.engine && xpert?.model && props.chat?.setEngineModel) {
    props.chat.setEngineModel(xpert.engine, xpert.model)
    if (props.chat.messages.length === 0) {
      llmManager.setChatModel(xpert.engine, xpert.model)
    }
  }
  
  nextTick(() => {
    input.value?.focus()
  })
}

const onSendPrompt = () => {

  // do not send if already prompting
  if (promptingState.value !== 'idle') {
    return
  }

  let message = prompt.value.trim()
  if (command.value) {
    message = commandI18n(command.value, 'template').replace('{input}', message)
    command.value = null
  }
  prompt.value = defaultPrompt(props.conversationMode)
  
  nextTick(() => {
    autoGrow(input.value)
    const sendPromptParams: SendPromptParams = {
      instructions: instructions.value?.instructions,
      prompt: message,
      attachments: attachments.value,
      docrepos: docrepos.value,
      expert: store.experts.find((e) => e.id === expert.value?.id),
      execMode: deepResearchActive.value ? 'deepresearch' : 'prompt',
    }
    emit('prompt', sendPromptParams)
    attachments.value = []
  })
}

const onStopPrompting = () => {
  promptingState.value = 'canceling'
  emit('stop', null)
}

const onAttach = async () => {

  await closePromptMenu()
  
  let files = window.api.file.pickFile({ multiselection: true, /*filters: [
    { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }
  ]*/ })
  if (Array.isArray(files)) {
    for (const filepath of files) {
      
      // check format
      const format = filepath.split('.').pop()
      if (!llmManager.canProcessFormat(engine(), model(), format)) {
        console.error('Cannot attach format', format)
        Dialog.alert(`${filepath.split('/').pop()}: ${t('prompt.attachment.formatError.title')}`, t('prompt.attachment.formatError.text'))
        return
      }

      try {
        // load
        const fileContents = window.api.file.read(filepath)
        const mimeType = extensionToMimeType(format)
        attach(fileContents.contents, mimeType, fileContents.url)
      } catch (err) {
        console.error('Error reading file', err)
        Dialog.alert(`${filepath.split('/').pop()}: Error reading file`)
      }

    }
  }
}


const onPaste = (event: ClipboardEvent) => {
  for (let item of event.clipboardData.items) {

    if (item.kind === 'string' && item.type === 'text/plain') {
      item.getAsString((str) => {
        if (str) {
          prompt.value += str
          nextTick(() => {
            autoGrow(input.value)
            input.value.focus()
          })
        }
      })
      return
    }

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
    await toAttach.loadContents()
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
        emitBusEvent('audio-noise-detected')
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
      
      onRecordingComplete: async (audioBlob: Blob, noiseDetected: boolean) => {

        try {

          // do that always
          audioRecorder.release()
          dictating.value = false

          // if streaming we are all done
          if (audioBlob.size) {

            // update
            prompt.value = defaultPrompt(props.conversationMode)

            // if no noise stop everything
            if (!noiseDetected) {
              return
            }

            // transcribe
            processing.value = true
            const response = await transcriber.transcribe(audioBlob)
            if (response) {
              prompt.value = response.text
            }

          }

          // execute?
          if (props.conversationMode !== 'off'/* || store.config.stt.silenceAction === 'stop_execute' || store.config.stt.silenceAction === 'execute_continue'*/) {

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
  showConversationMenu.value = true
}

const handleConversationClick = (action: string) => {
  closeContextMenu()
  emit('conversation-mode', (action || 'off') as ConversationMode)
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
  emitBusEvent('audio-noise-detected')
  emit('conversation-mode', 'off' as ConversationMode)
}

const isContextMenuOpen = () => {
  return showExperts.value || showCommands.value || showConversationMenu.value || showPromptMenu.value || showModelMenu.value
}

const closeContextMenu = () => {
  showExperts.value = false
  showCommands.value = false
  showConversationMenu.value = false
  showPromptMenu.value = false
  showModelMenu.value = false
  nextTick(() => {
    input.value.focus()
  })
}

const onPromptMenu = () => {
  closeContextMenu()
  showPromptMenu.value = true
}

const onModelMenu = () => {
  closeContextMenu()
  showModelMenu.value = true
}

const closePromptMenu = async () => {
  showPromptMenu.value = false
  await nextTick()
  input.value.focus()
}

const closeModelMenu = async () => {
  showModelMenu.value = false
  await nextTick()
  input.value.focus()
}

const handleDocReposChanged = (docRepoUuids: string[]) => {
  setDocRepos(docRepoUuids)
}

const handleManageDocRepo = () => {
  window.api.docrepo.open()
  closePromptMenu()
}

const handleManageExperts = () => {
  window.api.settings.open({ initialTab: 'experts' })
  closePromptMenu()
}

const handleModelSelected = (engine: string, model: string) => {
  props.chat?.setEngineModel(engine, model)
  emit('set-engine-model', engine, model)
  closeModelMenu()
}

const onNoEngineAvailable = async () => {
  console.warn('Prompt: No engines available, showing settings dialog')
  closeModelMenu()
  const rc = await Dialog.show({
    title: t('prompt.noEngineAvailable.title'),
    text: t('prompt.noEngineAvailable.text'),
    showCancelButton: true,
    confirmButtonText: t('common.yes'),
    cancelButtonText: t('common.no'),
  })
  if (rc.isConfirmed) {
    window.api.settings.open({ initialTab: 'models' })
  }
}

const removeDocRepo = (uuid: string) => {
  setDocRepos(docrepos.value.filter(id => id !== uuid))
}

const setDocRepos = (uuids: string[]) => {
  docrepos.value = uuids
  if (props.chat) {
    props.chat.docrepos = uuids.length ? uuids : undefined
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

const handleAllPluginsToggle = async () => {
  props.chat.tools = await ts.handleAllPluginsToggle(props.chat.tools)
  emit('tools-updated', props.chat.tools)
}

const handlePluginToggle = async (pluginName: string) => {
  props.chat.tools = await ts.handlePluginToggle(props.chat.tools, pluginName)
  emit('tools-updated', props.chat.tools)
}

const handleSelectAllTools = async (visibleIds?: string[] | null) => {
  props.chat.tools = await ts.handleSelectAllTools(visibleIds)
  emit('tools-updated', props.chat.tools)
}

const handleUnselectAllTools = async (visibleIds?: string[] | null) => {
  props.chat.tools = await ts.handleUnselectAllTools(visibleIds)
  emit('tools-updated', props.chat.tools)
}

const handleSelectAllPlugins = async (visibleIds?: string[] | null) => {
  props.chat.tools = await ts.handleSelectAllPlugins(props.chat.tools, visibleIds)
  emit('tools-updated', props.chat.tools)
}

const handleUnselectAllPlugins = async (visibleIds?: string[] | null) => {
  props.chat.tools = await ts.handleUnselectAllPlugins(props.chat.tools, visibleIds)
  emit('tools-updated', props.chat.tools)
}

const handleSelectAllServerTools = async (server: McpServerWithTools, visibleIds?: string[] | null) => {
  props.chat.tools = await ts.handleSelectAllServerTools(props.chat.tools, server, visibleIds)
  emit('tools-updated', props.chat.tools)
}

const handleUnselectAllServerTools = async (server: McpServerWithTools, visibleIds?: string[] | null) => {
  props.chat.tools = await ts.handleUnselectAllServerTools(props.chat.tools, server, visibleIds)
  emit('tools-updated', props.chat.tools)
}

const handleAllServerToolsToggle = async (server: McpServerWithTools) => {
  props.chat.tools = await ts.handleAllServerToolsToggle(props.chat.tools, server)
  emit('tools-updated', props.chat.tools)
}

const handleServerToolToggle = async (server: McpServerWithTools, tool: McpTool) => {
  props.chat.tools = await ts.handleServerToolToggle(props.chat.tools, server, tool)
  emit('tools-updated', props.chat.tools)
}

const handleExpertClick = (action: string) => {
  closeContextMenu()
  if (action === 'clear' || action === 'none') {
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

const onCommands = () => {
  commandsAnchor.value = `#commands-menu-${uniqueId.value}`
  runCommandImmediate = true
  showCommands.value = true
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
    const sendKey = store.config.appearance.chat.sendKey || 'enter'
    const shouldSend = sendKey === 'enter' ? !event.shiftKey : event.shiftKey
    if (shouldSend) {
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

    // get caret position and text info
    const caret = input.value.selectionStart
    const text = prompt.value
    const textBeforeCaret = text.substring(0, caret)
    const textAfterCaret = text.substring(caret)

    // check if on first/last line
    const onFirstLine = !textBeforeCaret.includes('\n')
    const onLastLine = !textAfterCaret.includes('\n')

    // Note: atLineStart and atLineEnd are not currently used but kept for future reference
    // const atLineStart = caret === 0 || textBeforeCaret.endsWith('\n')
    // const atLineEnd = caret === text.length || textAfterCaret.startsWith('\n')

    // determine if we should navigate history
    // ArrowUp: navigate if on first line AND at start of line (position 0)
    // ArrowDown: navigate if on last line AND at end of text
    let shouldNavigate = false
    if (event.key === 'ArrowUp') {
      // On first line: if at start, navigate history; otherwise go to start of line
      if (onFirstLine && caret === 0) {
        shouldNavigate = true
      }
    } else {
      // ArrowDown: on last line, if at end navigate history; if not at end, go to end
      if (onLastLine && caret === text.length) {
        shouldNavigate = true
      }
    }

    // shift key forces history navigation from anywhere
    if (event.shiftKey) {
      shouldNavigate = true
    }

    if (!shouldNavigate) {
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
      commandsAnchor.value = '.prompt .textarea-wrapper'
      runCommandImmediate = false
      showCommands.value = true
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

const onKeyUp = (event: Event) => {
  nextTick(() => {
    autoGrow(event.target as HTMLElement)
  })
}

const autoGrow = (element: HTMLElement) => {
  if (element) {
    // reset before calculating
    element.style.height = '0px'
    element.style.height = Math.min(150, Math.max(24, element.scrollHeight + 4)) + 'px'
  }
}

const addToFavorites = () => {
  if (props.chat) {
    llmManager.addFavoriteModel(props.chat.engine, props.chat.model)
    tipsManager.showTip('favoriteModels')
  }
}

const removeFavorite = () => {
  if (props.chat) {
    llmManager.removeFavoriteModel(props.chat.engine, props.chat.model)
  }
}

const clearExpert = () => {
  expert.value = null
}

const clearDocRepos = () => {
  setDocRepos([])
}

const clearInstructions = () => {
  instructions.value = null
}

const clearDeepResearch = () => {
  deepResearchActive.value = false
}

const getDocRepoName = (uuid: string) => {
  const doc = docRepos.value.find(d => d.uuid === uuid)
  return doc?.name || 'Knowledge Base'
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
  font-size: 16px;
}

.prompt {
  
  padding: 1rem;
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
      color: var(--highlight-color);
    }

    &.dictate.active {
      color: red;
    }

    &.remove-favorite {
      color: var(--color-error);
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
        transform: scale(0.9);
      }

      .icon.left.loader-wrapper {
        position: relative;
        top: -8px;
        margin-left: 0;
        margin-right: -8px;
        height: 19px;
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
        padding: 0px;
        background-color: var(--prompt-input-bg-color);
        color: var(--prompt-input-text-color);
        border: none;
        resize: none;
        box-sizing: border-box;
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
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.25rem;

    &:not(:has(*)) {
      display: none;
    }

    .prompt-menu {
      position: relative;
      left: -4px;
      .icon {
        transform: scale(1.2);
      }
    }

    .model-menu-button {
      display: flex;
      flex-direction: row;
      align-items: center;
      cursor: pointer;
      gap: 0.25rem;

      .model-name {
        font-size: 13px;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--prompt-icon-color);
      }

      svg {
        stroke: var(--prompt-icon-color);
        width: var(--icon-md);
        height: var(--icon-md);
      }

      .icon.caret {
        width: 0.5rem;
        height: 0.75rem;
      }
        
    }

    .send-stop {
      
      width: 2rem;
      height: 2rem;
      border-radius: 0.375rem;
      background-color: var(--prompt-icon-color);
      display: flex;
      align-items: center;
      justify-content: center;

      svg {
        width: var(--icon-md);
        height: var(--icon-md);
        stroke: var(--color-surface);
      }

      &:has(.disabled) {
        background-color: var(--color-surface-high);
      }

      &:has(.canceling) {
        opacity: 0.6;
        cursor: not-allowed;
        svg {
          animation: pulse 1.5s ease-in-out infinite;
        }
      }

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

@keyframes pulse {
  0%, 100% {
    scale: 1.05;
  }
  50% {
    scale: 0.75;
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
