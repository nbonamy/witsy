<template>
  <div class="scratchpad split-pane">

    <ScratchpadSidebar 
      fileUrl="fileUrl"
      :scratchpads="scratchpads"
      :selectedScratchpad="selectedScratchpad"
      :contextMenuTarget="targetScratchpad"
      @action="onAction" />

    <div class="sp-main">
      <main>
        <div class="document" :style="documentStyle" @click="onDocumentClick">
          <TiptapEditor
            ref="editorRef"
            v-model="content"
            :placeholder="placeholder"
            :file-path="currentTitle"
            show-outline
            show-source-toggle
            :export-formats="['md', 'docx']"
          />
          <div v-if="processing" class="generating-overlay">
            <Loader /><Loader /><Loader />
          </div>
        </div>
        <ScratchpadActionBar :saveState="saveState" :copyState="copyState" :audioState="audioState" :processing="processing" @action="onAction" />
      </main>
      <div v-if="hasResponseContent" class="response-popover">
        <div class="response-close" @click="responseMessage = null"><XIcon /></div>
        <MessageItem :message="responseMessage" :chat="chat" :showRole="false" :showActions="false" />
      </div>
      <Prompt
        :chat="chat"
        :is-generating="processing"
        :enable-instructions="false"
        :enable-commands="false"
        :conversation-mode="conversationMode"
        :history-provider="historyProvider"
        @set-engine-model="onSetEngineModel"
        @conversation-mode="onConversationMode"
        @prompt="onSendPrompt"
        @stop="onStopPrompting"
        ref="prompt" />
      <audio/>
    </div>

    <ScratchpadSettings ref="settingsDialog" @save="onSaveSettings" />

    <ContextMenuPlus
      v-if="showMenu && targetScratchpad"
      :mouseX="menuX"
      :mouseY="menuY"
      @close="closeContextMenu"
    >
      <template #default>
        <div @click="onRenameScratchpad"><PencilIcon /> {{ t('common.rename') }}</div>
        <div class="danger" @click="onDeleteScratchpad"><Trash2Icon /> {{ t('common.delete') }}</div>
      </template>
    </ContextMenuPlus>

    <ContextMenuPlus
      v-if="showArchiveMenu"
      anchor=".archive-action"
      position="left"
      @close="showArchiveMenu = false"
    >
      <template #default>
        <div @click="onArchiveVersion">{{ t('scratchpad.versions.archive') }}</div>
        <template v-if="versions.length > 0">
          <div class="separator"><hr></div>
          <div v-for="version in versions" :key="version.name" @click="onRecallVersion(version)">
            {{ version.name }}
          </div>
        </template>
      </template>
    </ContextMenuPlus>

  </div>
</template>

<script setup lang="ts">

import { CodeExecutionMode } from '@/types/config'
import ContextMenuPlus from '@components/ContextMenuPlus.vue'
import TiptapEditor from '@components/editor/TiptapEditor.vue'
import Loader from '@components/Loader.vue'
import Prompt, { ConversationMode, SendPromptParams } from '@components/Prompt.vue'
import useEventBus from '@composables/event_bus'
import useEventListener from '@composables/event_listener'
import useIpcListener from '@composables/ipc_listener'
import Chat from '@models/chat'
import Message from '@models/message'
import useAudioPlayer, { AudioState, AudioStatus } from '@renderer/audio/audio_player'
import Dialog from '@renderer/utils/dialog'
import Generator, { GenerationResult } from '@services/generator'
import { fullExpertI18n, i18nInstructions, t } from '@services/i18n'
import LlmFactory, { ILlmManager } from '@services/llms/llm'
import { availablePlugins } from '@services/plugins/plugins'
import { store } from '@services/store'
import MessageItem from '@components/MessageItem.vue'
import { PencilIcon, Trash2Icon, XIcon } from 'lucide-vue-next'
import { LlmEngine } from 'multi-llm-ts'
import { FileContents } from 'types/file'
import { ScratchpadData, ScratchpadHeader, ScratchpadVersion } from 'types/index'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ScratchpadActionBar from '../scratchpad/ActionBar.vue'
import ScratchpadSettings from '../scratchpad/Settings.vue'
import ScratchpadSidebar from '../scratchpad/Sidebar.vue'
import { buildScratchpadToolDelegate } from '../scratchpad/toolDelegate'

export interface ToolbarAction {
  type: string,
  value: any
}

// events
const { onBusEvent } = useEventBus()
const { onDomEvent } = useEventListener()
const { onIpcEvent } = useIpcListener()

// load store
store.load()

const placeholder = t('scratchpad.placeholder')

const chat = ref<Chat>(null)
const prompt = ref<typeof Prompt>(null)
const editorRef = ref<InstanceType<typeof TiptapEditor>>(null)
const settingsDialog = ref(null)
const processing = ref(false)
const engine = ref<string>(null)
const model = ref<string>(null)
const fontFamily = ref<string>(null)
const fontSize = ref<string>(null)
const autoSave = ref<boolean>(false)

const fontSizeMap: Record<string, { size: string, spacing: string }> = {
  '1': { size: '14px', spacing: '2px' },
  '2': { size: '15px', spacing: '4px' },
  '3': { size: '16px', spacing: '6px' },
  '4': { size: '17px', spacing: '8px' },
  '5': { size: '18px', spacing: '10px' },
}

const fontFamilyMap: Record<string, string> = {
  'serif': 'var(--font-family-serif)',
  'sans-serif': 'var(--font-family-base)',
  'monospace': 'monospace',
}

const documentStyle = computed(() => {
  const sizeEntry = fontSizeMap[fontSize.value] || fontSizeMap['3']
  return {
    '--sp-font-family': fontFamilyMap[fontFamily.value] || 'var(--font-family-base)',
    '--sp-font-size': sizeEntry.size,
    '--sp-spacing': sizeEntry.spacing,
  }
})

const hasResponseContent = computed(() => {
  if (!responseMessage.value) return false
  let content = responseMessage.value.content.replaceAll(/<tool id="([^"]+)"><\/tool>/g, '')
  return content.trim().length > 0
})

const content = ref<string>('')
const audioState = ref<AudioState>('idle')
const copyState = ref<string>('idle')
const saveFlash = ref<'idle'|'saving'|'saved'>('idle')
const conversationMode = ref<ConversationMode>('off')
const responseMessage = ref<Message>(null)
const currentScratchpadId = ref<string>(null)
const currentTitle = ref<string>(null)
const lastSavedContent = ref<string | null>(null)
const scratchpads = ref<ScratchpadHeader[]>([])
const selectedScratchpad = ref<ScratchpadHeader>(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetScratchpad = ref<ScratchpadHeader>(null)
const versions = ref<ScratchpadVersion[]>([])
const showArchiveMenu = ref(false)

const props = defineProps({
  extra: Object
})

// init stuff
store.loadSettings()
const audioPlayer = useAudioPlayer(store.config)
const generator = new Generator(store.config)
let abortController: AbortController | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// init stuff
const llmManager: ILlmManager = LlmFactory.manager(store.config)
let llm: LlmEngine = null
let fileUrl: string = null

const onEditorKeyDown = (ev: Event) => {
  const keyEv = ev as KeyboardEvent
  const isCommand = !keyEv.shiftKey && !keyEv.altKey && (keyEv.metaKey || keyEv.ctrlKey)

  if (isCommand && keyEv.key == 'n') {
    keyEv.preventDefault()
    onClear()
  } else if (isCommand && keyEv.key == 's') {
    keyEv.preventDefault()
    onSave()
  } else if (isCommand && keyEv.key == 'r') {
    keyEv.preventDefault()
    onReadAloud()
  }
}

const onConversationMode = (mode: ConversationMode) => {
  conversationMode.value = mode
}

onMounted(() => {

  // events
  audioPlayer.addListener(onAudioPlayerStatus)
  onIpcEvent('start-dictation', onStartDictation)

  // load settings
  fontFamily.value = store.config.scratchpad.fontFamily || 'serif'
  fontSize.value = store.config.scratchpad.fontSize || '3'
  autoSave.value = store.config.scratchpad.autoSave ?? false

  // load scratchpads list
  loadScratchpadsList()

  // override some system shortcuts
  onDomEvent(editorRef.value?.$el, 'keydown', onEditorKeyDown)

  // focus editor by default
  editorRef.value?.editor?.commands.focus()

  // init
  resetState()

  // query params
  if (props.extra && props.extra.scratchpadId) {
    loadScratchpadsList()
    onSelectScratchpad({ uuid: props.extra.scratchpadId } as ScratchpadHeader)
  }

})

// Watch for extra prop changes (when component is already mounted)
watch(() => props.extra, (newExtra) => {
  if (newExtra && newExtra.scratchpadId) {
    loadScratchpadsList()
    onSelectScratchpad({ uuid: newExtra.scratchpadId } as ScratchpadHeader)
  }
}, { deep: true })

const onDocumentClick = () => {
  if (!editorRef.value?.editor?.isFocused) {
    editorRef.value?.editor?.commands.focus()
  }
}

const historyProvider = (): string[] => {
  const messages = chat.value?.messages.filter(m => m.role === 'user') || []
  const history = messages.map(m => {
    const askMatch = m.content.match(/\nASK:\s*(.+)$/s)
    return askMatch ? askMatch[1].trim() : m.content
  }).filter(m => m.trim() !== '')
  return Array.from(new Set(history))
}

// autosave: debounce content changes
watch(content, () => {
  if (!autoSave.value) return
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    if (checkIfModified()) {
      onSave({ autoSave: true })
    }
  }, 2000)
})

onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  audioPlayer.removeListener(onAudioPlayerStatus)
})

const onWorkspaceChanged = () => {
  selectedScratchpad.value = null
  resetState()
  loadScratchpadsList()
}

const onStartDictation = () => {
  prompt.value?.startDictation()
}

const loadScratchpadsList = () => {
  scratchpads.value = window.api.scratchpad.list(store.config.workspaceId)
}

/**
 * Helper to extract markdown string from ScratchpadData.contents
 * Handles both old format ({ content, start, end }) and new format (string)
 */
const extractContent = (contents: any): string => {
  if (typeof contents === 'string') return contents
  if (contents && typeof contents.content === 'string') return contents.content
  return ''
}

const resetState = () => {

  // easy reset
  content.value = ''
  processing.value = false
  lastSavedContent.value = ''

  currentScratchpadId.value = null
  currentTitle.value = null
  selectedScratchpad.value = null
  versions.value = []
  fileUrl = null

  // init new chat
  chat.value = new Chat()
  chat.value.addMessage(new Message('system', i18nInstructions(store.config, 'instructions.scratchpad.system')))

  // init llm
  initLlm()

}

const initLlm = () => {

  // load engine and model
  engine.value = store.config.scratchpad.engine
  model.value = store.config.scratchpad.model
  if (!engine?.value.length || !model?.value.length) {
    ({ engine: engine.value, model: model.value } = llmManager.getChatEngineModel(false))
  }

  // set chat
  chat.value.setEngineModel(engine.value, model.value)
  store.initChatWithDefaults(chat.value)

  // prompt
  llm = llmManager.igniteEngine(engine.value)

}

const checkIfModified = (): boolean => {
  // New scratchpad: modified if content is not empty
  if (!currentScratchpadId.value) {
    return content.value.trim().length > 0
  }

  // Existing scratchpad: compare with cached saved content
  return content.value !== lastSavedContent.value
}

const saveState = computed(() => {
  if (saveFlash.value !== 'idle') return saveFlash.value
  if (checkIfModified()) return autoSave.value ? 'pending' : 'dirty'
  return 'idle'
})

const onAction = (action: string|ToolbarAction) => {

  // basic actions
  const actions: { [key: string]: CallableFunction} = {
    'clear': onClear,
    'save': onSave,
    'copy': onCopy,
    'read': onReadAloud,
    'settings': onSettings,
    'import': onImport,
    'archive': onShowArchiveMenu
  }

  // find
  if (typeof action === 'string') {
    const callback = actions[action as string]
    if (callback) {
      callback()
      return
    }
  }


  // advanced actions
  const toolbarAction = action as ToolbarAction
  switch (toolbarAction.type) {

    case 'select-scratchpad':
      onSelectScratchpad(toolbarAction.value)
      return

    case 'context-menu':
      onContextMenu(toolbarAction.value)
      return

    case 'llm':
      engine.value = toolbarAction.value.engine
      model.value = toolbarAction.value.model
      store.config.scratchpad.engine = engine.value
      store.config.scratchpad.model = model.value
      store.saveSettings()
      initLlm()
      return

    case 'magic':
      if (content.value.trim().length) {
        const prompt = i18nInstructions(store.config, `instructions.scratchpad.${toolbarAction.value}`)
        onSendPrompt({ prompt: prompt })
      }
      return
  }

}

const confirmOverwrite = (callback: CallableFunction) => {

  if (!checkIfModified()) {
    callback()
    return
  }

  Dialog.show({
    title: t('common.confirmation.continueQuestion'),
    showCancelButton: true,
    confirmButtonText: t('common.cancel'),
    cancelButtonText: t('common.confirmation.continue'),
  }).then((result) => {
    if (result.isDismissed) {
      callback()
    }
  })
}

const onClear = () => {
  confirmOverwrite(() => {
    resetState()
  })
}

const onSelectScratchpad = async (scratchpad: ScratchpadHeader) => {
  // Check for unsaved changes
  if (checkIfModified()) {
    const result = await Dialog.show({
      title: t('common.confirmation.unsavedChanges'),
      text: t('scratchpad.unsavedPrompt'),
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: t('common.save'),
      denyButtonText: t('scratchpad.dontSave'),
      cancelButtonText: t('common.cancel')
    })

    if (result.isDismissed) {
      return // Cancel - don't switch
    }

    if (result.isConfirmed) {
      // Save first
      await onSave()
    }
    // If denied, continue without saving
  }

  try {
    const data = window.api.scratchpad.load(store.config.workspaceId, scratchpad.uuid)
    if (!data) {
      Dialog.alert(t('scratchpad.loadingError'))
      return
    }

    // update state
    processing.value = false
    currentScratchpadId.value = data.uuid
    currentTitle.value = data.title
    selectedScratchpad.value = scratchpad

    // load content (handles both old and new format)
    const loadedContent = extractContent(data.contents)
    content.value = loadedContent
    lastSavedContent.value = loadedContent
    versions.value = data.versions || []

    // chat - restore from data or create new
    if (data.chat) {
      chat.value = Chat.fromJson(data.chat)
    } else {
      chat.value = new Chat()
      chat.value.addMessage(new Message('system', i18nInstructions(store.config, 'instructions.scratchpad.system')))
    }

    // init llm based on loaded chat or defaults
    initLlm()

  } catch (err) {
    console.error(err)
    Dialog.alert(t('scratchpad.loadingError'))
  }
}

const extractFileExtension = (url: string): string => {
  const filename = url.split(/[/\\]/).pop() || ''
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ext
}

const extractDefaultTitle = (url: string): string => {
  const filename = url.split(/[/\\]/).pop() || 'Document'
  const name = filename.replace(/\.[^.]+$/, '')
  return name
}

const convertDocxToMarkdown = async (base64Contents: string): Promise<string> => {
  const mammoth = await import('mammoth')
  const buffer = Uint8Array.from(atob(base64Contents), c => c.charCodeAt(0))
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer.buffer })
  // let TipTap parse the HTML by setting it on the editor, then read back as markdown
  const tiptapEditor = editorRef.value?.editor
  if (tiptapEditor) {
    tiptapEditor.commands.setContent(result.value)
    return tiptapEditor.getMarkdown()
  }
  return result.value
}

const onImport = () => {
  confirmOverwrite(async () => {
    try {
      // pick file
      const file = window.api.file.pickFile({
        filters: [
          { name: 'Documents', extensions: ['txt', 'md', 'docx', 'pdf'] },
          { name: 'Text', extensions: ['txt', 'md'] },
          { name: 'Word', extensions: ['docx'] },
          { name: 'PDF', extensions: ['pdf'] },
        ]
      })
      if (!file) return

      const fileContents = file as FileContents
      const ext = extractFileExtension(fileContents.url)
      const defaultTitle = extractDefaultTitle(fileContents.url)

      // prompt for title
      const result = await Dialog.show({
        title: t('scratchpad.import.title'),
        text: t('scratchpad.import.prompt'),
        input: 'text',
        inputValue: defaultTitle,
        showCancelButton: true
      })
      if (!result.isConfirmed || !result.value) return

      // convert file contents to markdown based on format
      let markdown = ''
      if (ext === 'docx') {
        markdown = await convertDocxToMarkdown(fileContents.contents)
      } else if (ext === 'pdf') {
        markdown = await window.api.file.extractText(fileContents.contents, 'pdf')
      } else {
        // txt, md — decode base64 to string (supports unicode)
        markdown = window.api.base64.decode(fileContents.contents)
      }

      // set as new scratchpad
      resetState()
      content.value = markdown
      currentTitle.value = result.value
      currentScratchpadId.value = crypto.randomUUID()
      lastSavedContent.value = null

      // auto-save
      await onSave()

    } catch (err) {
      console.error(err)
      Dialog.alert(t('scratchpad.importError'))
    }
  })
}

const onSave = async (opts?: { autoSave?: boolean }) => {
  try {
    // If no current scratchpad, prompt for title (or use default for autosave)
    if (!currentScratchpadId.value) {
      if (opts?.autoSave) {
        currentScratchpadId.value = crypto.randomUUID()
        currentTitle.value = t('scratchpad.untitled')
      } else {
        const result = await Dialog.show({
          title: t('scratchpad.save.title'),
          text: t('scratchpad.save.prompt'),
          input: 'text',
          inputValue: '',
          showCancelButton: true
        })
        if (!result.isConfirmed || !result.value) return

        currentScratchpadId.value = crypto.randomUUID()
        currentTitle.value = result.value
      }
    }

    // Build scratchpad data — contents is now a markdown string
    const data: ScratchpadData = {
      uuid: currentScratchpadId.value,
      title: currentTitle.value,
      contents: content.value,
      chat: chat.value,
      createdAt: Date.now(),
      lastModified: Date.now(),
      versions: versions.value.length > 0 ? versions.value : undefined
    }

    // Save (serialize to avoid cloning errors with complex objects)
    const success = window.api.scratchpad.save(store.config.workspaceId, JSON.parse(JSON.stringify(data)))
    if (success) {
      lastSavedContent.value = content.value
      loadScratchpadsList()
      // Update selected scratchpad
      selectedScratchpad.value = scratchpads.value.find(s => s.uuid === currentScratchpadId.value)
      // Flash save icon: blue (saving) → green (saved) → idle
      saveFlash.value = 'saving'
      setTimeout(() => saveFlash.value = 'saved', 1000)
      setTimeout(() => saveFlash.value = 'idle', 1750)
    } else {
      Dialog.alert(t('scratchpad.saveError'))
    }

  } catch (err) {
    console.error(err)
    Dialog.alert(t('scratchpad.saveError'))
  }
}

const onCopy = () => {
  window.api.clipboard.writeText(content.value)
  copyState.value = 'copied'
  setTimeout(() => copyState.value = 'idle', 1000)
}

const onReadAloud = async () => {
  if (content.value.trim().length) {
    audioState.value = 'loading'
    await audioPlayer.play(document.querySelector('.scratchpad audio'), 'scratchpad', content.value)
  }
}

const onSettings = () => {
  settingsDialog.value?.show()
}

const onShowArchiveMenu = () => {
  showArchiveMenu.value = true
}

const onArchiveVersion = async () => {
  showArchiveMenu.value = false
  const result = await Dialog.show({
    title: t('scratchpad.versions.archive'),
    input: 'text',
    inputValue: '',
    showCancelButton: true
  })
  if (!result.isConfirmed || !result.value) return

  versions.value.push({
    name: result.value,
    content: content.value
  })

  // persist if scratchpad is already saved
  if (currentScratchpadId.value) {
    await onSave()
  }
}

const onRecallVersion = async (version: ScratchpadVersion) => {
  showArchiveMenu.value = false
  const result = await Dialog.show({
    title: t('scratchpad.versions.recallTitle', { name: version.name }),
    text: t('scratchpad.versions.recallConfirm'),
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: t('scratchpad.versions.recall'),
    denyButtonText: t('scratchpad.versions.delete'),
    cancelButtonText: t('common.cancel')
  })

  if (result.isConfirmed) {
    content.value = version.content
  } else if (result.isDenied) {
    versions.value = versions.value.filter(v => v !== version)
    if (currentScratchpadId.value) {
      await onSave()
    }
  }
}

const onSaveSettings = (settings: { fontFamily: string, fontSize: string, autoSave: boolean }) => {
  fontFamily.value = settings.fontFamily
  fontSize.value = settings.fontSize
  autoSave.value = settings.autoSave
  store.config.scratchpad.fontFamily = fontFamily.value
  store.config.scratchpad.fontSize = fontSize.value
  store.config.scratchpad.autoSave = autoSave.value
  store.saveSettings()
}

const onContextMenu = ({ event, scratchpad }: { event: MouseEvent, scratchpad: ScratchpadHeader }) => {
  targetScratchpad.value = scratchpad
  menuX.value = event.clientX
  menuY.value = event.clientY
  showMenu.value = true
}

const closeContextMenu = () => {
  showMenu.value = false
  targetScratchpad.value = null
}

const onRenameScratchpad = async () => {
  if (!targetScratchpad.value) return

  // Keep reference before closing menu
  const scratchpad = targetScratchpad.value
  closeContextMenu()

  const result = await Dialog.show({
    title: t('scratchpad.rename.title'),
    text: t('scratchpad.rename.prompt'),
    input: 'text',
    inputValue: scratchpad.title,
    showCancelButton: true
  })

  if (result.isConfirmed && result.value) {
    const success = window.api.scratchpad.rename(
      store.config.workspaceId,
      scratchpad.uuid,
      result.value
    )

    if (success) {
      // Update current title if renaming current scratchpad
      if (currentScratchpadId.value === scratchpad.uuid) {
        currentTitle.value = result.value
      }
      loadScratchpadsList()
    } else {
      Dialog.alert(t('scratchpad.renameError'))
    }
  }
}

const onDeleteScratchpad = async () => {
  if (!targetScratchpad.value) return

  // Keep reference before closing menu
  const scratchpad = targetScratchpad.value
  closeContextMenu()

  const result = await Dialog.show({
    title: t('scratchpad.delete.title'),
    text: t('scratchpad.delete.confirm', { title: scratchpad.title }),
    showCancelButton: true,
    confirmButtonText: t('common.delete'),
    cancelButtonText: t('common.cancel')
  })

  if (result.isConfirmed) {
    const success = window.api.scratchpad.delete(
      store.config.workspaceId,
      scratchpad.uuid
    )

    if (success) {
      // Clear editor if deleting current scratchpad
      if (currentScratchpadId.value === scratchpad.uuid) {
        resetState()
      }
      loadScratchpadsList()
    } else {
      Dialog.alert(t('scratchpad.deleteError'))
    }
  }
}

const onAudioPlayerStatus = (status: AudioStatus) => {
  audioState.value = status.state
}

const onSetEngineModel = (engine: string, model: string) => {
  store.config.scratchpad.engine = engine
  store.config.scratchpad.model = model
  store.saveSettings()
  initLlm()
}

const onSendPrompt = async (params: SendPromptParams) => {

  // one at a time
  if (processing.value) {
    return
  }

  // deconstruct params
  const { prompt, attachments, expert } = params

  // we need a prompt
  if (!prompt) {
    return
  }

  // set
  processing.value = true
  responseMessage.value = null

  // check for selection (use saved selection from blur, or live selection)
  // if selection covers the entire document, treat as no selection
  const selection = editorRef.value?.getSelectedMarkdown()
  const hasSelection = !!selection && selection.markdown.trim() !== content.value.trim()

  // what are we working with?
  const subject = (hasSelection ? selection.markdown : content.value).trim()

  // update system prompt based on selection state
  const systemKey = hasSelection ? 'instructions.scratchpad.systemSelection' : 'instructions.scratchpad.system'
  chat.value.messages[0].setText(i18nInstructions(store.config, systemKey))

  // now build the prompt
  let finalPrompt = prompt
  if (subject.length > 0) {
    const template = i18nInstructions(store.config, 'instructions.scratchpad.prompt')
    finalPrompt = template.replace('{ask}', prompt).replace('{document}', subject)
  }

  // build the tool delegate
  const toolDelegate = buildScratchpadToolDelegate(hasSelection, {
    getContent: () => content.value,
    setContent: (c: string) => { content.value = c },
    replaceSelection: (markdown: string) => {
      editorRef.value?.replaceSelection(markdown)
    },
  })

  // add to thread
  const userMessage = new Message('user', finalPrompt)
  userMessage.setExpert(fullExpertI18n(expert))
  for (const attachment of attachments ?? []) {
    await attachment.loadContents()
    userMessage.attach(attachment)
  }
  chat.value.addMessage(userMessage)

  // add response
  const response = new Message('assistant')
  chat.value.addMessage(response)

  try {

    // code execution mode from config
    const codeExecutionMode: CodeExecutionMode = store.config.llm.codeExecution

    // load tools as configured per prompt
    await llmManager.loadTools(llm, store.config.workspaceId, availablePlugins, chat.value.tools, { codeExecutionMode })

    // create abort controller
    abortController = new AbortController()

    // now generate
    const rc: GenerationResult = await generator.generate(llm, chat.value.messages, {
      ...chat.value.modelOpts,
      model: chat.value.model,
      docrepos: chat.value.docrepos,
      sources: false,
      abortSignal: abortController.signal,
      toolExecutionDelegate: toolDelegate,
    })

    // user cancelled — discard partial result
    if (rc === 'stopped') return

    if (rc !== 'success') {
      throw new Error(response.content)
    }

    // show response in popover
    responseMessage.value = response

  } catch (err) {
    console.error(err)
    Dialog.alert(t('scratchpad.generationError'))

  } finally {

    // done
    processing.value = false

  }

}

const onStopPrompting = async () => {
  abortController?.abort()
}

</script>

<style scoped>

.scratchpad {

  .sp-main {

    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }

    .document {
      flex: 1;
      overflow-y: scroll;
      display: flex;
      flex-direction: column;
      position: relative;
      scrollbar-color: var(--scrollbar-thumb-color) var(--background-color);
    }

    .generating-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: var(--space-16);
      background-color: var(--color-surface);
      opacity: 0.7;
      z-index: 10;

      &:deep(.loader) {
        width: var(--icon-xl);
        height: var(--icon-xl);
      }
    }

  }

  .document :deep(.tiptap-editor-wrapper) {
    flex: 1;
  }

  .document :deep(.tiptap-content) {
    padding-right: 100px;
  }

  .document, .document * {
    outline: none;
  }

  .response-popover {
    position: relative;
    margin: 0 1rem;
    padding: var(--space-8);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-menu);
    max-height: 200px;
    overflow-y: auto;

    .response-close {
      position: absolute;
      top: var(--space-8);
      right: var(--space-8);
      cursor: pointer;
      color: var(--color-text-muted);
      z-index: 1;

      &:hover {
        color: var(--color-text);
      }

      svg {
        width: var(--icon-md);
        height: var(--icon-md);
      }
    }

    &:deep() {

      .message {
        margin: 0;
        padding: 0;
        flex-direction: column;
      }

      .message-body {
        margin: 0;
        padding: 0 0.5rem;
      }

      .message-content {
        font-size: 0.9em;
        .tool-container {
          display: none;
        }
        p {
          margin: 0;
        }
        ul {
          margin-top: 0;
          margin-bottom: 0.5rem;
        }
      }

      .message-actions {
        visibility: visible;
        font-size: 0.8em;
        margin: 0 0.5rem;
      }

    }

  }

  :deep(.prompt) {
    margin: 1rem;
  }

}

</style>
