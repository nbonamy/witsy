<template>
  <div class="scratchpad">
    <div class="toolbar">
      <button class="tool" @click="onClear"><BIconFileEarmark /><span>New</span></button>
      <!-- <button class="tool" @click="onUndo" :disabled="!undoStack.length"><BIconArrowLeft /><span>Undo</span></button>
      <button class="tool" @click="onRedo" :disabled="!redoStack.length"><BIconArrowRight /><span>Redo</span></button> -->
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
      <EditableText ref="editor" :placeholder="placeholder"/>
    </div>
    <div class="actionbar-wrapper">
      <div class="actionbar" v-if="activeBar == 'standard'">
        <div class="action" @click="onUndo" v-tooltip="'Undo'" :class="{ disabled: !undoStack.length }">
          <BIconReplyFill />
        </div>
        <div class="action" @click="onRedo" v-tooltip="'Redo'" :class="{ disabled: !undoStack.length }">
          <BIconReplyFill style="transform: scaleX(-1)"/>
        </div>
        <div class="action" @click="onCopy" v-tooltip="'Copy to clipboard'">
          <BIconClipboard v-if="copyState == 'idle'"/>
          <BIconClipboardCheck v-else/>
        </div>
        <div class="action" @click="onMagicAction($event, 'spellcheck')" v-tooltip="'Spellcheck'">
          <BIconSpellcheck />
        </div>
        <div class="action" @click="onMagicBar" v-tooltip="'Writing assistant'">
          <BIconStars />
        </div>
        <div :class="{ action: true, active: audioState == 'playing' }" @click="onReadAloud" v-tooltip="'Read aloud'">
          <span v-if="audioState == 'playing'"><BIconStopCircle/></span>
          <span v-else-if="audioState == 'loading'"><BIconXCircle/></span>
          <span v-else><BIconVolumeUp /></span>
        </div>
      </div>
      <div class="actionbar" v-if="activeBar == 'magic'">
        <div class="action" @click="onStandardBar" v-tooltip="'Back'">
          <BIconArrowLeft />
        </div>
        <div class="action" @click="onMagicAction($event, 'improve')" v-tooltip="'Improve writing'">
          <BIconMortarboard />
        </div>
        <div class="action" @click="onMagicAction($event, 'takeaways')" v-tooltip="'List key takeaways'">
          <BIconListUl />
        </div>
        <div class="action" @click="onMagicAction($event, 'title')" v-tooltip="'Suggest a title'">
          <BIconFonts />
        </div>
        <div class="action" @click="onMagicAction($event, 'simplify')" v-tooltip="'Simplify writing'">
          <BIconChevronBarContract />
        </div>
        <div class="action" @click="onMagicAction($event, 'expand')" v-tooltip="'Expand writing'">
          <BIconChevronBarExpand />
        </div>
      </div>
    </div>
    <Prompt :chat="assistant.chat" :processing="processing" :enable-doc-repo="false" :enable-commands="false"/>
    <audio/>
  </div>
</template>

<script setup>

// components
import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import { download, saveFileContents } from '../services/download'
import { BIconFileEarmark } from 'bootstrap-icons-vue'
import FloatingVue, { vTooltip } from 'floating-vue'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import EditableText from '../components/EditableText.vue'
import Prompt from '../components/Prompt.vue'
import useAudioPlayer from '../composables/audio_player'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

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
const engine = ref(null)
const model = ref(null)
const processing = ref(false)
const fontFamily = ref(null)
const fontSize = ref(null)
const undoStack = ref([])
const redoStack = ref([])
const audioState = ref('idle')
const copyState = ref('idle')
const activeBar = ref('standard')

const audioPlayer = useAudioPlayer()

let attachment = null

onMounted(() => {

  // events
  onEvent('sendPrompt', onSendPrompt)
  onEvent('stopAssistant', onStopAssistant)
  onEvent('attachFile', onAttachFile)
  onEvent('detachFile', onDetachFile)
  useAudioPlayer().addListener(onAudioPlayerStatus)

  // init
  engine.value = store.config.scratchpad.engine || store.config.llm.engine
  model.value = store.config.scratchpad.model || store.config.getActiveModel(engine.value)
  fontFamily.value = store.config.scratchpad.fontFamily || 'serif'
  fontSize.value = store.config.scratchpad.fontSize || '3'

  // configure
  FloatingVue.options.distance = 16
  FloatingVue.options.instantMove = true
  FloatingVue.options.autoHideOnMousedown = true
  FloatingVue.options.themes.tooltip.placement = 'left'
  FloatingVue.options.themes.tooltip.delay.show = 0

})

const onClear = () => {
  editor.value.setContent({ content: '' })
  assistant.value.setChat(null)
  undoStack.value = []
  redoStack.value = []
}

const onChangeEngine = () => {
  store.config.scratchpad.engine = engine.value
  model.value = store.config.getActiveModel(engine.value)
  onChangeModel()
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

      // if chunk text is null it means we had an error
      if (chunk.text == null) {
        processing.value = false
        return
      }

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

const onUndo = () => {
  if (undoStack.value.length > 0) {
    const action = undoStack.value.pop()
    redoStack.value.push(action)
    editor.value.setContent(action.before)
    assistant.value.chat.messages.splice(-2, 2)
  }
}

const onRedo = () => {
  if (redoStack.value.length > 0) {
    const action = redoStack.value.pop()
    undoStack.value.push(action)
    editor.value.setContent(action.after)
    assistant.value.chat.messages.push(...action.messages)
  }
}

const onCopy = () => {
  window.api.clipboard.writeText(editor.value.getContent().content)
  copyState.value = 'copied'
  setTimeout(() => copyState.value = 'idle', 1000)
}

const onReadAloud = async () => {
  audioState.value = 'loading'
  const text = editor.value.getContent().content
  await audioPlayer.play(document.querySelector('.scratchpad audio'), 'scratchpad', text)
}

const onAudioPlayerStatus = (status) => {
  audioState.value = status.state
}

const onMagicBar = () => {
  activeBar.value = 'magic'
}

const onStandardBar = () => {
  activeBar.value = 'standard'
}

const onMagicAction = (event, action) => {
  event.target.closest('.action').classList.add('active')
  onSendPrompt(store.config.instructions.scratchpad[action])
  setTimeout(() => event.target.closest('.action').classList.remove('active'), 1000)
}

</script>

<style>
@import 'floating-vue/dist/style.css'
</style>

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

  .actionbar-wrapper {
    position: absolute;
    right: 20px;
    bottom: 64px;
    border: 1px solid #ccc;
    border-radius: 20px;
    padding: 16px 12px;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
    transition: height 0.15s linear;
    background-color: rgba(255, 255, 255, 0.95);
    z-index: 10;

    &:hover {
      border-color: #aaa;
    }

    .actionbar {
      display: flex;
      flex-direction: column-reverse;
      gap: 12px;
    }
    
    .action {
      color: #aaa;
      font-size: 14pt;
      cursor: pointer;

      &.active {
        color: #2991FF;
      }

    }
  }

  .prompt {
    border-top: 1px solid #ccc;
    background-color: #e7e6e5;
  }
}

</style>

