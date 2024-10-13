
<template>
  <div class="scratchpad">
    <ScratchPadToolbar :engine="engine" :model="model" :fontFamily="fontFamily" :fontSize="fontSize" />
    <div class="document" :class="[ fontFamily, `size-${fontSize}` ]">
      <EditableText ref="editor" :placeholder="placeholder"/>
    </div>
    <ScratchPadActionBar :undoStack="undoStack" :redoStack="redoStack" :copyState="copyState" :audioState="audioState" />
    <Prompt :chat="assistant.chat" :processing="processing" :enable-doc-repo="false" :enable-commands="false" :conversation-mode="conversationMode" />
    <audio/>
  </div>
</template>

<script setup>

// components
import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import ScratchPadToolbar from '../scratchpad/Toolbar.vue'
import ScratchPadActionBar from '../scratchpad/ActionBar.vue'
import EditableText from '../components/EditableText.vue'
import Prompt from '../components/Prompt.vue'
import useAudioPlayer from '../composables/audio_player'
import Chat from '../models/chat'
import Dialog from '../composables/dialog'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

// load store
store.load()

// assistant
import Assistant from '../services/assistant'
const assistant = ref(new Assistant(store.config))

const placeholder = ref(`Start typing your document or
ask Witsy to write something for you!

Once you started you can ask Witsy
to make modification on your document.

If you highligh a portion of your text,
Witsy will only update this portion.

Also check out the Writing Assistant
in the action bar in the lower right corner!

Give it a go!`.replaceAll('\n', '<br/>'))

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
const modifiedCheckDelay = 1000
let modifiedCheckTimeout = null
let attachment = null
let fileUrl = null

const resetState = () => {
  assistant.value.stop()
  editor.value.setContent({ content: '' })
  assistant.value.setChat(null)
  modified.value = false
  processing.value = false
  undoStack.value = []
  redoStack.value = []
  fileUrl = null
}

onMounted(() => {

  // events
  onEvent('send-prompt', onSendPrompt)
  onEvent('stop-assistant', onStopAssistant)
  onEvent('attach-file', onAttachFile)
  onEvent('detach-file', onDetachFile)
  onEvent('action', onAction)
  onEvent('conversation-mode', (mode) => conversationMode.value = mode)
  audioPlayer.addListener(onAudioPlayerStatus)

  // load settings
  engine.value = store.config.scratchpad.engine || store.config.llm.engine
  model.value = store.config.scratchpad.model || store.config.getActiveModel(engine.value)
  fontFamily.value = store.config.scratchpad.fontFamily || 'serif'
  fontSize.value = store.config.scratchpad.fontSize || '3'

  // confirm close
  window.onbeforeunload = (e) => {
    if (modified.value) {
      Dialog.show({
        title: 'You have unsaved changes. You will lose your work if you close this window.',
        showCancelButton: true,
        confirmButtonText: 'Do not close',
        cancelButtonText: 'Close anyway',
        reverseButtons: true
      }).then((result) => {
        if (!result.isConfirmed) {
          modified.value = false
          window.close()
        }
      })
      e.returnValue = false
    }
  }

  // override some system shortcuts
  editor.value.$el.addEventListener('keydown', (e) => {

    const isCommand = !e.shift && (e.metaKey || e.ctrlKey)
    const isShiftCommand = e.shift && (e.metaKey || e.ctrlKey)

    if (isCommand && e.key == 'n') {
      e.preventDefault()
      onClear()
    } else if (isCommand && e.key == 'o') {
      e.preventDefault()
      onLoad()
    } else if (isCommand && e.key == 's') {
      e.preventDefault()
      onSave()
    } else if (isCommand && e.key == 'z') {
      e.preventDefault()
      onUndo()
    } else if ((isCommand && e.key == 'y') && (isShiftCommand && e.key == 'z')) {
      e.preventDefault()
      onRedo()
    } else if (isCommand && e.key == 'r') {
      e.preventDefault()
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

})

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
        messages: assistant.value.chat?.messages.slice(-2)
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
        messages: assistant.value.chat?.messages.slice(-2)
      })
      redoStack.value = []
      modified.value = true
    }

  }

}

const onAction = (action) => {

  // basic actions
  const actions = {
    'clear': onClear,
    'load': onLoad,
    'save': onSave,
    'undo': onUndo,
    'redo': onRedo,
    'copy': onCopy,
    'read': onReadAloud
  }

  // find
  const callback = actions[action]
  if (callback) {
    callback()
    return
  }


  // advanced actions
  switch (action.type) {

    case 'fontFamily':
      fontFamily.value = action.value
      store.config.scratchpad.fontFamily = fontFamily.value
      store.saveSettings()
      return

    case 'fontSize':
      fontSize.value = action.value
      store.config.scratchpad.fontSize = fontSize.value
      store.saveSettings()
      return

    case 'llm':
      engine.value = action.engine
      model.value = action.model
      store.config.scratchpad.engine = engine.value
      store.config.scratchpad.model = model.value
      store.saveSettings()
      return
    
    case 'magic':
      const contents = editor.value.getContent()
      if (contents.content.trim().length) {
        const prompt = store.config.instructions.scratchpad[action.action]
        onSendPrompt(prompt)
      } else {
        emitEvent('llm-done')
      }
      return
  }

}

const confirmOverwrite = (callback) => {

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
    if (!result.isConfirmed) {
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
      const scratchpad = JSON.parse(window.api.base64.decode(file.contents))
      if (!scratchpad || !scratchpad.contents || !scratchpad.undoStack || !scratchpad.redoStack) {
        alert('This file is not a scratchpad file. Please try again with another file.')
      }

      // reset
      resetState()

      // update stuff
      fileUrl = file.url
      editor.value.setContent(scratchpad.contents)
      undoStack.value = scratchpad.undoStack
      redoStack.value = scratchpad.redoStack

      // chat
      if (scratchpad.chat) {
        const chat = new Chat(scratchpad.chat)
        assistant.value.setChat(chat)
      }

    } catch (err) {
      console.error(err)
      alert('Error while loading scratchpad file')
    }
  })

}

const onSave = () => {
  const scratchpad = {
    contents: editor.value.getContent(),
    chat: assistant.value.chat,
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
    assistant.value.chat?.messages?.splice(-2, 2)
    modified.value = true
  }
}

const onRedo = () => {
  if (redoStack.value.length > 0) {
    const action = redoStack.value.pop()
    undoStack.value.push(action)
    editor.value.setContent(action.after)
    assistant.value.chat?.messages?.push(...action.messages)
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

const onAudioPlayerStatus = (status) => {
  audioState.value = status.state
}

const onAttachFile = async (file) => {
  store.pendingAttachment = file
}

const onDetachFile = async () => {
  store.pendingAttachment = null
}

const onSendPrompt = async (userPrompt) => {

  // one at a time
  if (processing.value) {
    return
  }
  
  // we need a prompt
  if (!userPrompt) {
    return
  }
  
  // get text and selection
  const contents = editor.value.getContent()

  // what are we working with?
  let selection = contents.selection != null
  let subject = contents.selection || contents.content
  subject = subject.trim()

  // now build the prompt
  let finalPrompt = userPrompt
  if (subject.length > 0) {
    const template = store.config.instructions.scratchpad.prompt
    finalPrompt = template.replace('{ask}', userPrompt).replace('{document}', subject)
  }

  // log
  processing.value = true
  console.log(finalPrompt)

  // prompt
  assistant.value.prompt(finalPrompt, {
    save: false,
    titling: false,
    overwriteEngineModel: true,
    engine: engine.value,
    model: model.value,
    systemInstructions: store.config.instructions.scratchpad.system,
    attachment: store.pendingAttachment,
  }, (chunk) => {

    // if done
    if (chunk?.done) {

      // done
      emitEvent('llm-done')

      // if chunk text is null it means we had an error
      if (chunk.text == null) {
        processing.value = false
        return
      }

      // modified
      modified.value = true

      // default to all response
      const response = assistant.value.chat.lastMessage().content
      const action = {
        content: response,
        start: 0,
        end: 0
      }

      // if we have a selection, replace it
      if (selection) {
        action.content = contents.content.substring(0, contents.start) + response + contents.content.substring(contents.end)
        action.start = contents.start
        action.end = contents.start + response.length
      }

      // add to undo stack
      undoStack.value.push({
        before: contents,
        after: action,
        messages: assistant.value.chat.messages.slice(-2)
      })

      // empty redo
      redoStack.value = []

      // now do it
      editor.value.setContent(action)

      // done
      processing.value = false
    
    }
  })

  // clear stuff
  store.pendingAttachment = null

}

const onStopAssistant = async () => {
  await assistant.value.stop()
}

</script>

<style scoped>

.scratchpad {
  display: flex;
  flex-direction: column;
  height: 100vh;

  .toolbar {
    display: flex;
    flex-direction: row;
    height: 32px;
    padding: 8px 16px 8px 100px;
    align-items: center;
    background-color: #e7e6e5;
    border-bottom: 1px solid #ccc;
    -webkit-app-region: drag;
    gap: 8px;

    .tool {

      max-width: 128px;
      white-space: nowrap;
      padding: 6px 8px;
      font-size: 11pt;
      margin: 0;

      &:enabled {
        -webkit-app-region: no-drag;
      }

      svg {
        position: relative;
        margin-right: 8px;
        top: 2px;
      }

    }

    select.tool {
      border: 1px solid #cacaca;
      border-radius: 6px;
      font-size: 10pt;
      padding-right: 0px;
    }

  }

  .document {
    flex: 1;
    overflow-y: scroll;
    display: flex;
    flex-direction: column;
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
    color: #444;
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
    border-top: 1px solid #ccc;
    background-color: #e7e6e5;
  }
}

</style>

