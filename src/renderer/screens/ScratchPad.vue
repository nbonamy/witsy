<template>
  <div class="scratchpad split-pane">

    <ScratchpadSidebar :fileUrl="fileUrl" :scratchpads="scratchpads" :selectedScratchpad="selectedScratchpad" :contextMenuTarget="targetScratchpad" />

    <div class="sp-main">
      <main>
        <div class="document" :class="[ fontFamily, `size-${fontSize}` ]">
          <EditableText ref="editor" :placeholder="placeholder"/>
        </div>
        <ScratchpadActionBar :undoStack="undoStack" :redoStack="redoStack" :copyState="copyState" :audioState="audioState" />
      </main>
      <Prompt :chat="chat" :processing="processing" :enable-instructions="false" :enable-commands="false" :conversation-mode="conversationMode" @set-engine-model="onSetEngineModel" @prompt="onSendPrompt" @stop="onStopPrompting" ref="prompt" />
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
        <div @click="onRenameScratchpad">
          <span>{{ t('common.rename') }}</span>
        </div>
        <div @click="onDeleteScratchpad">
          <span>{{ t('common.delete') }}</span>
        </div>
      </template>
    </ContextMenuPlus>

  </div>
</template>

<script setup lang="ts">
import { LlmEngine } from 'multi-llm-ts'
import { onMounted, onBeforeUnmount, ref } from 'vue'
import ContextMenuPlus from '../components/ContextMenuPlus.vue'
import EditableText from '../components/EditableText.vue'
import Prompt, { SendPromptParams } from '../components/Prompt.vue'
import useAudioPlayer, { AudioState, AudioStatus } from '../composables/audio_player'
import Dialog from '../composables/dialog'
import useEventBus from '../composables/event_bus'
import LlmFactory, { ILlmManager } from '../services/llms/llm'
import Chat from '../../models/chat'
import Message from '../../models/message'
import { availablePlugins } from '../services/plugins/plugins'
import ScratchpadActionBar from '../scratchpad/ActionBar.vue'
import ScratchpadSettings from '../scratchpad/Settings.vue'
import ScratchpadSidebar from '../scratchpad/Sidebar.vue'
import Generator, { GenerationResult } from '../services/generator'
import { fullExpertI18n, i18nInstructions, t } from '../services/i18n'
import { store } from '../services/store'
import { FileContents } from 'types/file'
import { ScratchpadHeader, ScratchpadData } from 'types/index'

export interface ToolbarAction {
  type: string,
  value: any
}

// bus
const { onEvent, emitEvent } = useEventBus()

// load store
store.load()

const placeholder = ref(t('scratchpad.placeholder').replaceAll('\n', '<br/>'))

const chat = ref<Chat>(null)
const prompt = ref<typeof Prompt>(null)
const editor = ref<typeof EditableText>(null)
const settingsDialog = ref(null)
const processing = ref(false)
const engine = ref<string>(null)
const model = ref<string>(null)
const fontFamily = ref<string>(null)
const fontSize = ref<string>(null)
const undoStack = ref<Array<any>>([])
const redoStack = ref<Array<any>>([])
const audioState = ref<AudioState>('idle')
const copyState = ref<string>('idle')
const conversationMode = ref(null)
const currentScratchpadId = ref<string>(null)
const currentTitle = ref<string>(null)
const lastSavedContent = ref<string | null>(null)
const scratchpads = ref<ScratchpadHeader[]>([])
const selectedScratchpad = ref<ScratchpadHeader>(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetScratchpad = ref<ScratchpadHeader>(null)

const props = defineProps({
  extra: Object
})

// init stuff
store.loadSettings()
const audioPlayer = useAudioPlayer(store.config)
const generator = new Generator(store.config)
let abortController: AbortController | null = null

// init stuff
const llmManager: ILlmManager = LlmFactory.manager(store.config)
let llm: LlmEngine = null
const undoStackCheckDelay = 1000
let undoStackCheckTimeout: NodeJS.Timeout = null
let fileUrl: string = null

onMounted(() => {

  // events
  onEvent('action', onAction)
  onEvent('conversation-mode', (mode: string) => conversationMode.value = mode)
  audioPlayer.addListener(onAudioPlayerStatus)
  window.api.on('start-dictation', onStartDictation)

  // load settings
  fontFamily.value = store.config.scratchpad.fontFamily || 'serif'
  fontSize.value = store.config.scratchpad.fontSize || '3'

  // load scratchpads list
  loadScratchpadsList()

  // // handle mode switches with unsaved changes
  // onEvent('main-view-changed', (newMode: string) => {
  //   if (newMode !== 'scratchpad' && modified.value) {
  //     // Mode is about to change away from scratchpad, check for unsaved changes
  //     emitEvent('set-main-window-mode', 'scratchpad') // Revert to scratchpad
  //     Dialog.show({
  //       title: t('common.confirmation.unsavedChanges'),
  //       showCancelButton: true,
  //       confirmButtonText: t('common.confirmation.doNotClose'),
  //       cancelButtonText: t('common.confirmation.closeAnyway'),
  //       reverseButtons: true
  //     }).then((result) => {
  //       if (result.isDismissed) {
  //         modified.value = false // Clear modified flag
  //         emitEvent('set-main-window-mode', newMode) // Allow mode change
  //       }
  //     })
  //   }
  // })

  // override some system shortcuts
  editor.value.$el.addEventListener('keydown', (ev: KeyboardEvent) => {

    const isCommand = !ev.shiftKey && !ev.altKey && (ev.metaKey || ev.ctrlKey)
    const isShiftCommand = ev.shiftKey && !ev.altKey && (ev.metaKey || ev.ctrlKey)

    if (isCommand && ev.key == 'n') {
      ev.preventDefault()
      onClear()
    } else if (isCommand && ev.key == 's') {
      ev.preventDefault()
      onSave()
    } else if (isCommand && ev.key == 'z') {
      ev.preventDefault()
      onUndo()
    } else if ((isCommand && ev.key == 'y') || (isShiftCommand && ev.key.toLocaleLowerCase() == 'z')) {
      ev.preventDefault()
      onRedo()
    } else if (isCommand && ev.key == 'r') {
      ev.preventDefault()
      onReadAloud()
    }

  })

  // for undo/redo stack building
  document.addEventListener('keyup', (e) => {
    resetUndoStackCheckTimeout()
  })

  // init
  resetState()

  // query params
  if (props.extra && props.extra.textId) {
    const text = window.api.automation.getText(props.extra.textId)
    editor.value.setContent({ content: text })
  }

})

onBeforeUnmount(() => {
  window.api.off('start-dictation', onStartDictation)
  audioPlayer.removeListener(onAudioPlayerStatus)
  clearTimeout(undoStackCheckTimeout)
})

const onStartDictation = () => {
  prompt.value?.startDictation()
}

const loadScratchpadsList = () => {
  scratchpads.value = window.api.scratchpad.list(store.config.workspaceId)
}

const resetState = () => {

  // easy reset
  editor.value.setContent({ content: '' })
  processing.value = false

  // Initialize with empty baseline so first edit is undoable
  initializeUndoStack({ content: '', start: null, end: null })

  currentScratchpadId.value = null
  currentTitle.value = null
  selectedScratchpad.value = null
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

const initializeUndoStack = (contents: { content: string, start?: number | null, end?: number | null }) => {
  undoStack.value = [{
    before: contents,
    after: contents,
    messages: []
  }]
  redoStack.value = []
  lastSavedContent.value = contents.content
}

const resetUndoStackCheckTimeout = () => {
  clearTimeout(undoStackCheckTimeout)
  undoStackCheckTimeout = setTimeout(() => {
    updateUndoStack()
  }, undoStackCheckDelay)
}

const updateUndoStack = () => {
  const contents = editor.value?.getContent()
  if (!contents) return

  if (!undoStack.value.length) {
    // if no undo then only if there is content
    if (contents.content.trim().length) {
      undoStack.value.push({
        before: { content: '', start: null, end: null },
        after: contents,
        messages: chat.value.messages.slice(-2)
      })
      redoStack.value = []
    }
  } else {
    // check if the last action is different
    const lastState = undoStack.value[undoStack.value.length - 1]
    const lastContent = lastState.after.content
    if (contents.content !== lastContent) {
      undoStack.value.push({
        before: lastState.after,
        after: contents,
        messages: chat.value.messages.slice(-2)
      })
      redoStack.value = []
    }
  }
}

const checkIfModified = (): boolean => {
  const contents = editor.value?.getContent()
  if (!contents) return false

  // New scratchpad: modified if content is not empty
  if (!currentScratchpadId.value) {
    return contents.content.trim().length > 0
  }

  // Existing scratchpad: compare with cached saved content
  return contents.content !== lastSavedContent.value
}

const onAction = (action: string|ToolbarAction) => {

  // basic actions
  const actions: { [key: string]: CallableFunction} = {
    'clear': onClear,
    'save': onSave,
    'undo': onUndo,
    'redo': onRedo,
    'copy': onCopy,
    'read': onReadAloud,
    'settings': onSettings,
    'import': onImport
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
      const contents = editor.value.getContent()
      if (contents.content.trim().length) {
        const prompt = i18nInstructions(store.config, `instructions.scratchpad.${toolbarAction.value}`)
        onSendPrompt({ prompt: prompt })
      } else {
        emitEvent('llm-done', null)
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

    // clear current state (don't call resetState as it creates new chat)
    editor.value.setContent({ content: '' })
    processing.value = false

    // update state
    currentScratchpadId.value = data.uuid
    currentTitle.value = data.title
    selectedScratchpad.value = scratchpad
    editor.value.setContent(data.contents)

    // Initialize undo stack with loaded content as baseline
    // This ensures undo won't erase the loaded content
    initializeUndoStack(data.contents)

    // chat - restore from data or create new
    if (data.chat) {
      chat.value = new Chat(data.chat)
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

const onImport = () => {
  confirmOverwrite(async () => {
    try {
      // pick file
      const file = window.api.file.pickFile({
        filters: [ { name: 'Scratchpad', extensions: ['json'] }]
      })
      if (!file) return

      // get filename without extension and format as title
      const fileContents = file as FileContents
      const filename = fileContents.url.split(/[/\\]/).pop()?.replace(/\.json$/i, '') || 'Scratchpad'
      const defaultTitle = filename.split(/[-_\s]/).map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')

      // prompt for title
      const result = await Dialog.show({
        title: t('scratchpad.import.title'),
        text: t('scratchpad.import.prompt'),
        input: 'text',
        inputValue: defaultTitle,
        showCancelButton: true
      })
      if (!result.isConfirmed || !result.value) return

      // import (file.url is already a proper path or file:// URI)
      const uuid = window.api.scratchpad.import(store.config.workspaceId, fileContents.url, result.value)

      if (uuid) {
        loadScratchpadsList()
        // Load the imported scratchpad
        const scratchpad = scratchpads.value.find(s => s.uuid === uuid)
        if (scratchpad) {
          onSelectScratchpad(scratchpad)
        }
      } else {
        Dialog.alert(t('scratchpad.importError'))
      }

    } catch (err) {
      console.error(err)
      Dialog.alert(t('scratchpad.importError'))
    }
  })
}

const onSave = async () => {
  try {
    // If no current scratchpad, prompt for title
    if (!currentScratchpadId.value) {
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

    // Build scratchpad data (exclude undo/redo stacks - session only)
    const data: ScratchpadData = {
      uuid: currentScratchpadId.value,
      title: currentTitle.value,
      contents: editor.value.getContent(),
      chat: chat.value,
      createdAt: Date.now(),
      lastModified: Date.now()
    }

    // Save (serialize to avoid cloning errors with complex objects)
    const success = window.api.scratchpad.save(store.config.workspaceId, JSON.parse(JSON.stringify(data)))
    if (success) {
      // Initialize undo stack with saved content as baseline
      initializeUndoStack(data.contents)
      loadScratchpadsList()
      // Update selected scratchpad
      selectedScratchpad.value = scratchpads.value.find(s => s.uuid === currentScratchpadId.value)
    } else {
      Dialog.alert(t('scratchpad.saveError'))
    }

  } catch (err) {
    console.error(err)
    Dialog.alert(t('scratchpad.saveError'))
  }
}

const onUndo = () => {
  // Only allow undo if we have more than the baseline entry
  if (undoStack.value.length > 1) {
    const action = undoStack.value.pop()
    redoStack.value.push(action)
    editor.value.setContent(action.before)
    chat.value.messages?.splice(-2, 2)
  }
}

const onRedo = () => {
  if (redoStack.value.length > 0) {
    const action = redoStack.value.pop()
    undoStack.value.push(action)
    editor.value.setContent(action.after)
    chat.value.messages?.push(...action.messages)
  }
}

const onCopy = () => {
  window.api.clipboard.writeText(editor.value.getContent().content)
  copyState.value = 'copied'
  setTimeout(() => copyState.value = 'idle', 1000)
}

const onReadAloud = async () => {
  const text = editor.value.getContent().content
  if (text.trim().length) {
    audioState.value = 'loading'
    await audioPlayer.play(document.querySelector('.scratchpad audio'), 'scratchpad', text)
  }
}

const onSettings = () => {
  settingsDialog.value?.show()
}

const onSaveSettings = (settings: { fontFamily: string, fontSize: string }) => {
  fontFamily.value = settings.fontFamily
  fontSize.value = settings.fontSize
  store.config.scratchpad.fontFamily = fontFamily.value
  store.config.scratchpad.fontSize = fontSize.value
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
  
  // get text and selection
  const contents = editor.value.getContent()

  // what are we working with?
  let selection = contents.selection != null
  let subject = contents.selection || contents.content
  subject = subject.trim()

  // now build the prompt
  let finalPrompt = prompt
  if (subject.length > 0) {
    const template = i18nInstructions(store.config, 'instructions.scratchpad.prompt')
    finalPrompt = template.replace('{ask}', prompt).replace('{document}', subject)
  }

  // log
  //console.log(finalPrompt)

  // add to thead
  const userMessage = new Message('user', finalPrompt)
  userMessage.setExpert(fullExpertI18n(expert))
  for (const attachment of attachments ?? []) {
    attachment.loadContents()
    userMessage.attach(attachment)
  }
  chat.value.addMessage(userMessage)

  // add response
  const response = new Message('assistant')
  chat.value.addMessage(response)

  try {

    // load tools as configured per prompt
    llmManager.loadTools(llm, store.config.workspaceId, availablePlugins, chat.value.tools)

    // create abort controller
    abortController = new AbortController()

    // now generate
    processing.value = true
    const rc: GenerationResult = await generator.generate(llm, chat.value.messages, {
      ...chat.value.modelOpts,
      model: chat.value.model,
      docrepo: chat.value.docrepo,
      sources: false,
      abortSignal: abortController.signal,
    })

    if (rc !== 'success') {
      throw new Error(response.content)
    }

    // default to all response
    const action = {
      content: response.content,
      start: 0,
      end: 0
    }

    // if we have a selection, replace it
    if (selection) {
      action.content = contents.content.substring(0, contents.start) + response.content + contents.content.substring(contents.end)
      action.start = contents.start
      action.end = contents.start + response.content.length
    }

    // add to undo stack
    undoStack.value.push({
      before: contents,
      after: action,
      messages: chat.value.messages.slice(-2)
    })

    // empty redo
    redoStack.value = []

    // now do it
    editor.value.setContent(action)

  } catch (err) {
    console.error(err)
    Dialog.alert(t('scratchpad.generationError'))
  }

  // done
  emitEvent('llm-done', null)
  processing.value = false
    
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
      scrollbar-color: var(--scrollbar-thumb-color) var(--background-color);
    }

  }

  .document :deep(.container) {
    flex: 1;
  }

  .document :deep(.content) {
    padding: 32px;
    padding-right: 100px;
  }

  .document, .document * {
    outline: none;
    color: var(--scratchpad-text-color);
  }

  .document.serif, .document.serif * {
    font-family: var(--font-family-serif);
  }

  .document.monospace, .document.monospace * {
    font-family: monospace;
  }

  .document.size-1, .document.size-1 * {
    font-size: 16px;
  }

  .document.size-2, .document.size-2 * {
    font-size: 18px;
  }

  .document.size-3, .document.size-3 * {
    font-size: 20px;
  }

  .document.size-4, .document.size-4 * {
    font-size: 22px;
  }

  .document.size-5, .document.size-5 * {
    font-size: 24px;
  }

  :deep(.prompt) {
    margin: 1rem;
  }

}

</style>

