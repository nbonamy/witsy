
<template>
  <div class="scratchpad">
    <ScratchpadToolbar :engine="engine" :model="model" :fontFamily="fontFamily" :fontSize="fontSize" />
    <div class="document" :class="[ fontFamily, `size-${fontSize}` ]">
      <EditableText ref="editor" :placeholder="placeholder"/>
    </div>
    <ScratchpadActionBar :undoStack="undoStack" :redoStack="redoStack" :copyState="copyState" :audioState="audioState" />
    <Prompt :chat="chat" :processing="processing" :enable-commands="false" :conversation-mode="conversationMode" />
    <DocRepos />
    <audio/>
  </div>
</template>

<script setup lang="ts">

// components
import { FileContents } from 'types'
import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import { LlmEngine } from 'multi-llm-ts'
import LlmFactory from '../llms/llm'
import ScratchpadToolbar, { ToolbarAction } from '../scratchpad/Toolbar.vue'
import ScratchpadActionBar from '../scratchpad/ActionBar.vue'
import EditableText from '../components/EditableText.vue'
import Prompt from '../components/Prompt.vue'
import DocRepos from '../screens/DocRepos.vue'
import useAudioPlayer, { AudioStatus } from '../composables/audio_player'
import Dialog from '../composables/dialog'
import Generator from '../services/generator'
import Attachment from '../models/attachment'
import Message from '../models/message'
import Chat from '../models/chat'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

// load store
store.load()

const placeholder = ref(`Start typing your document or
ask Witsy to write something for you!

Once you started you can ask Witsy
to make modification on your document.

If you highligh a portion of your text,
Witsy will only update this portion.

Also check out the Writing Assistant
in the action bar in the lower right corner!

Give it a go!`.replaceAll('\n', '<br/>'))

const chat = ref(null)
const editor = ref(null)
const processing = ref(false)
const engine = ref(null)
const model = ref(null)
const fontFamily = ref(null)
const fontSize = ref(null)
const undoStack = ref([])
const redoStack = ref([])
const audioState = ref('idle')
const copyState = ref('idle')
const modified = ref(false)
const conversationMode = ref(null)

// init stuff
store.loadSettings()
const audioPlayer = useAudioPlayer(store.config)
const generator = new Generator(store.config)

// init stuff
let llm: LlmEngine = null
const modifiedCheckDelay = 1000
let modifiedCheckTimeout: NodeJS.Timeout = null
let fileUrl: string = null

onMounted(() => {

  // events
  onEvent('send-prompt', onSendPrompt)
  onEvent('stop-prompting', onStopPrompting)
  onEvent('action', onAction)
  onEvent('conversation-mode', (mode: string) => conversationMode.value = mode)
  audioPlayer.addListener(onAudioPlayerStatus)

  // load settings
  fontFamily.value = store.config.scratchpad.fontFamily || 'serif'
  fontSize.value = store.config.scratchpad.fontSize || '3'

  // confirm close
  window.onbeforeunload = (e) => {
    if (modified.value) {
      e.returnValue = false
      setTimeout(() => {
        Dialog.show({
          title: 'You have unsaved changes. You will lose your work if you close this window.',
          showCancelButton: true,
          confirmButtonText: 'Do not close',
          cancelButtonText: 'Close anyway',
          reverseButtons: true
        }).then((result) => {
          if (result.isDismissed) {
            window.onbeforeunload = null
            setTimeout(() => window.close(), 100)
          }
        })
      }, 100)
    }
  }

  // override some system shortcuts
  editor.value.$el.addEventListener('keydown', (ev: KeyboardEvent) => {

    const isCommand = !ev.shiftKey && !ev.altKey && (ev.metaKey || ev.ctrlKey)
    const isShiftCommand = ev.shiftKey && !ev.altKey && (ev.metaKey || ev.ctrlKey)

    if (isCommand && ev.key == 'n') {
      ev.preventDefault()
      onClear()
    } else if (isCommand && ev.key == 'o') {
      ev.preventDefault()
      onLoad()
    } else if (isCommand && ev.key == 's') {
      ev.preventDefault()
      onSave()
    } else if (isCommand && ev.key == 'z') {
      ev.preventDefault()
      onUndo()
    } else if ((isCommand && ev.key == 'y') || (isShiftCommand && ev.key == 'z')) {
      ev.preventDefault()
      onRedo()
    } else if (isCommand && ev.key == 'r') {
      ev.preventDefault()
      onReadAloud()
    }

  })  

  // for undo/redo
  document.addEventListener('keyup', (e) => {
    resetModifiedCheckTimeout()
  })

  // no need to show the tip
  store.config.general.tips.scratchpad = false
  store.saveSettings()

  // init
  resetState()

})

const resetState = () => {

  // easy reset
  editor.value.setContent({ content: '' })
  modified.value = false
  processing.value = false
  undoStack.value = []
  redoStack.value = []
  fileUrl = null

  // init new chat
  chat.value = new Chat()
  chat.value.addMessage(new Message('system', store.config.instructions.scratchpad.system))

  // init llm
  initLlm()

}

const initLlm = () => {

  // load engine and model
  const llmFactory = new LlmFactory(store.config)
  engine.value = store.config.scratchpad.engine
  model.value = store.config.scratchpad.model
  if (!engine?.value.length || !model?.value.length) {
    ({ engine: engine.value, model: model.value } = llmFactory.getChatEngineModel(false))
  }

  // prompt
  llm = llmFactory.igniteEngine(engine.value)

  // set chat
  chat.value.setEngineModel(engine.value, model.value)

}

const resetModifiedCheckTimeout = () => {
  clearTimeout(modifiedCheckTimeout)
  modifiedCheckTimeout = setTimeout(() => {
    checkIfModified()
  }, modifiedCheckDelay)
}

const checkIfModified = () => {
  
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
      modified.value = true
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
      modified.value = true
    }

  }

}

const onAction = (action: string|ToolbarAction) => {

  // basic actions
  const actions: { [key: string]: CallableFunction} = {
    'clear': onClear,
    'load': onLoad,
    'save': onSave,
    'undo': onUndo,
    'redo': onRedo,
    'copy': onCopy,
    'read': onReadAloud
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

    case 'fontFamily':
      fontFamily.value = toolbarAction.value
      store.config.scratchpad.fontFamily = fontFamily.value
      store.saveSettings()
      return

    case 'fontSize':
      fontSize.value = toolbarAction.value
      store.config.scratchpad.fontSize = fontSize.value
      store.saveSettings()
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
        const prompt = store.config.instructions.scratchpad[toolbarAction.value]
        onSendPrompt({ prompt: prompt, attachment: null, docrepo: null })
      } else {
        emitEvent('llm-done')
      }
      return
  }

}

const confirmOverwrite = (callback: CallableFunction) => {

  if (!modified.value) {
    callback()
    return
  }

  Dialog.show({
    title: 'You have unsaved changes. You will lose your work if you continue.',
    showCancelButton: true,
    confirmButtonText: 'Cancel',
    cancelButtonText: 'Continue',
    reverseButtons: true
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

const onLoad = () => {

  confirmOverwrite(() => {
    try {

      // pick
      const file = window.api.file.pick({
        filters: [ { name: 'Scratchpad', extensions: ['*.json'] }]
      })
      if (!file) return

      // parse
      const fileContents = file as FileContents
      const scratchpad = JSON.parse(window.api.base64.decode(fileContents.contents))
      if (!scratchpad || !scratchpad.contents || !scratchpad.undoStack || !scratchpad.redoStack) {
        Dialog.alert('This file is not a scratchpad file. Please try again with another file.')
      }

      // reset
      resetState()

      // update stuff
      fileUrl = fileContents.url
      editor.value.setContent(scratchpad.contents)
      undoStack.value = scratchpad.undoStack
      redoStack.value = scratchpad.redoStack

      // chat
      if (scratchpad.chat) {
        chat.value = new Chat(scratchpad.chat)
      }

    } catch (err) {
      console.error(err)
      Dialog.alert('Error while loading scratchpad file')
    }
  })

}

const onSave = () => {
  const scratchpad = {
    contents: editor.value.getContent(),
    chat: chat.value,
    undoStack: undoStack.value,
    redoStack: redoStack.value
  }
  const url = window.api.file.save({
    contents: window.api.base64.encode(JSON.stringify(scratchpad)),
    url: fileUrl ?? 'scratchpad.json',
    properties: {
      directory: 'documents',
      prompt: true,
    }
  })
  if (url) {
    fileUrl = url
    modified.value = false
  }
}

const onUndo = () => {
  if (undoStack.value.length > 0) {
    const action = undoStack.value.pop()
    redoStack.value.push(action)
    editor.value.setContent(action.before)
    chat.value.messages?.splice(-2, 2)
    modified.value = true
  }
}

const onRedo = () => {
  if (redoStack.value.length > 0) {
    const action = redoStack.value.pop()
    undoStack.value.push(action)
    editor.value.setContent(action.after)
    chat.value.messages?.push(...action.messages)
    modified.value = true
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

const onAudioPlayerStatus = (status: AudioStatus) => {
  audioState.value = status.state
}

const onSendPrompt = async ({ prompt, attachment, docrepo }: { prompt: string, attachment: Attachment, docrepo: string }) => {

  // one at a time
  if (processing.value) {
    return
  }
  
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
    const template = store.config.instructions.scratchpad.prompt
    finalPrompt = template.replace('{ask}', prompt).replace('{document}', subject)
  }

  // log
  console.log(finalPrompt)

  // add to thead
  const userMessage = new Message('user', finalPrompt)
  if (attachment) {
    attachment.loadContents()
    userMessage.attach(attachment)
  }
  chat.value.addMessage(userMessage)

  // add response
  const response = new Message('assistant')
  chat.value.addMessage(response)

  // now generate
  processing.value = true
  await generator.generate(llm, chat.value.messages, {
    model: chat.value.model,
    attachment: attachment,
    docrepo: chat.value.docrepo,
    sources: false,
  })

  // done
  emitEvent('llm-done')
  modified.value = true

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

  // done
  processing.value = false
    
}

const onStopPrompting = async () => {
  generator.stop()
}

</script>

<style scoped>

.scratchpad {
  
  display: flex;
  flex-direction: column;
  height: 100vh;

  .document {
    flex: 1;
    overflow-y: scroll;
    display: flex;
    flex-direction: column;
    background-color: var(--background-color);
    scrollbar-color: var(--scrollbar-thumb-color) var(--background-color);
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
    font-family: Garamond, Georgia, Times, 'Times New Roman', serif;
  }

  .document.monospace, .document.monospace * {
    font-family: monospace;
  }

  .document.size-1, .document.size-1 * {
    font-size: 11pt;
  }

  .document.size-2, .document.size-2 * {
    font-size: 13pt;
  }

  .document.size-3, .document.size-3 * {
    font-size: 15pt;
  }

  .document.size-4, .document.size-4 * {
    font-size: 17pt;
  }

  .document.size-5, .document.size-5 * {
    font-size: 19pt;
  }

  .prompt {
    border-top: 1px solid var(--scratchpad-bars-border-color);
    background-color: var(--dialog-header-bg-color);
  }
}

</style>

