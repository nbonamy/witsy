<template>
  <div class="scratchpad">
    <div class="toolbar">
      <button class="tool" @click="onClear"><BIconFileEarmark /><span>New</span></button>
      <button class="tool" @click="onUndo" :disabled="!undoStack.length"><BIconArrowLeft /><span>Undo</span></button>
      <button class="tool" @click="onRedo" :disabled="!redoStack.length"><BIconArrowRight /><span>Redo</span></button>
      <EngineSelect class="tool" v-model="engine" @change="onChangeEngine" />
      <ModelSelect class="tool" v-model="model" :engine="engine" @change="onChangeModel"/>
      <select class="tool" v-model="fontFamily">
        <option value="serif">Serif</option>
        <option value="sans-serif">Sans-Serif</option>
        <option value="monospace">Monospace</option>
      </select>
      <select class="tool" v-model="fontSize">
        <option value="1">Smaller</option>
        <option value="2">Small</option>
        <option value="3">Normal</option>
        <option value="4">Large</option>
        <option value="5">Larger</option>
      </select>
    </div>
    <div class="document" :class="[ fontFamily, `size-${fontSize}` ]">
      <EditableText ref="document" :placeholder="placeholder"/>
    </div>
    <Prompt :processing="processing" :enable-doc-repo="false" :enable-commands="false"/>
  </div>
</template>

<script setup>

// components
import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import { download, saveFileContents } from '../services/download'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import EditableText from '../components/EditableText.vue'
import Prompt from '../components/Prompt.vue'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

// load store
store.load()

// assistant
import Assistant from '../services/assistant'
import { BIconFileEarmark } from 'bootstrap-icons-vue'
const assistant = ref(new Assistant(store.config))

const placeholder = ref(`Start typing your document or
ask Witsy to write something for you!

Once you started you can ask Witsy to make modification on your document.

If you highligh a portion of your text,
Witsy will only update this portion.

Give it a go!`.replaceAll('\n', '<br/>'))

const engine = ref(null)
const model = ref(null)
const document = ref(null)
const processing = ref(false)
const fontFamily = ref(null)
const fontSize = ref(null)
const undoStack = ref([])
const redoStack = ref([])

let attachment = null

onMounted(() => {

  // events
  onEvent('sendPrompt', onSendPrompt)
  onEvent('stopAssistant', onStopAssistant)
  onEvent('attachFile', onAttachFile)
  onEvent('detachFile', onDetachFile)

  // init
  engine.value = store.config.scratchpad.engine || store.config.llm.engine
  model.value = store.config.scratchpad.model || store.config.getActiveModel(engine.value)
  fontFamily.value = store.config.scratchpad.fontFamily || 'serif'
  fontSize.value = store.config.scratchpad.fontSize || '3'

  // intercept links
  // document.addEventListener('click', (e) => {
  //   const target = e.target || e.srcElement
  //   const href = target.getAttribute('href')
  //   if (href === '#settings') {
  //     emitEvent('openSettings')
  //     e.preventDefault()
  //     return false
  //   }
  // })

})

const onClear = () => {
  document.value.setContent({ content: '' })
  assistant.value.setChat(null)
  undoStack.value = []
  redoStack.value = []
}

const onChangeEngine = () => {
  store.config.scratchpad.engine = engine.value
  model.value = store.config.getActiveModel(engine.value)
  store.saveSettings()
}

const onChangeModel = () => {
  store.config.scratchpad.model = model.value
  store.saveSettings()
}

const onAttachFile = async (file) => {
  store.pendingAttachment = file
}

const onDetachFile = async () => {
  store.pendingAttachment = null
}

const onSendPrompt = async (userPrompt) => {

  // we need a prompt
  if (!userPrompt) {
    return
  }
  
  // get text and selection
  const contents = document.value.getContent()

  // what are we working with?
  let selection = contents.selection != null
  let subject = contents.selection || contents.content
  subject = subject.trim()

  // now build the prompt
  let prompt = userPrompt
  if (subject.length > 0) {
    const template = store.config.instructions.scratchpad.prompt
    prompt = template.replace('{ask}', userPrompt).replace('{document}', subject)
  }

  // log
  processing.value = true
  console.log(prompt)

  // // save the attachment
  // if (store.pendingAttachment?.downloaded === false) {
  //   let filename = null
  //   if (store.pendingAttachment.url === 'clipboard://') {
  //     filename = saveFileContents(store.pendingAttachment.format(), store.pendingAttachment.contents)
  //   } else {
  //     filename = download(store.pendingAttachment.url)
  //   }
  //   if (filename) {
  //     store.pendingAttachment.downloaded = true
  //     store.pendingAttachment.url = `file://${filename}`
  //   }
  // }

  // prompt
  assistant.value.prompt(prompt, {
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
      document.value.setContent(action)

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

const onUndo = () => {
  if (undoStack.value.length > 0) {
    const action = undoStack.value.pop()
    redoStack.value.push(action)
    document.value.setContent(action.before)
    assistant.value.chat.messages.splice(-2, 2)
  }
}

const onRedo = () => {
  if (redoStack.value.length > 0) {
    const action = redoStack.value.pop()
    undoStack.value.push(action)
    document.value.setContent(action.after)
    assistant.value.chat.messages.push(...action.messages)
  }
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
      color: #666;
    }

  }

  .document {
    flex: 1;
    overflow-y: scroll;
    display: flex;
    flex-direction: column;
  }

  .document >>> .container {
    flex: 1;
  }

  .document >>> .content {
    padding: 32px;
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

