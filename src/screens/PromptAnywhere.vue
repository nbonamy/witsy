
<template>
  <div class="anywhere" @mousedown="onMouseDown" @mouseup="onMouseUp">
    <div class="container">
      <ResizableHorizontal :min-width="500" :resize-elems="false" :on-resize="onPromptResize" ref="resizerPrompt">
        <Prompt ref="prompt" :chat="chat" placeholder="Ask me anything" menus-position="below" :enable-doc-repo="false" :enable-attachments="true" :enable-experts="true" :enable-commands="false" :enable-conversations="false" />
      </ResizableHorizontal>
      <div class="spacer" />
      <ResizableHorizontal :min-width="500" :resize-elems="false" :on-resize="onResponseResize" ref="resizerResponse" v-if="response">
        <div class="response messages openai size4">
          <MessageItem :message="response" :show-role="false" :show-actions="false"/>
          <div class="actions">
            <MessageItemActionCopy :message="response" ref="actionCopy" />
            <div class="action insert" v-if="!isMas && !response.transient" @click="onInsert">
              <BIconArrowReturnLeft /> Insert
            </div>
            <MessageItemActionRead :message="response" :audio-state="audioState" :read-aloud="onReadAloud" />
            <div class="action continue" v-if="!response.transient" @click="onContinueConversation">
              <BIconBoxArrowInUpRight /> Open as Chat
            </div>
            <div class="action clear" @click="onClear">
              <BIconXCircle />  Clear
            </div>
            <div class="action close" @click="onClose">
              <span class="narrow">Esc</span> Close
            </div>
          </div>
        </div>
      </ResizableHorizontal>
    </div>
    <audio ref="audio" />
    <PromptDefaults id="defaults" @defaults-modified="initLlm" />
  </div>
</template>

<script setup lang="ts">

import { anyDict } from 'types'
import { Ref, ref, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import { availablePlugins } from '../plugins/plugins'
import { LlmEngine } from 'multi-llm-ts'
import useAudioPlayer, { AudioStatus } from '../composables/audio_player'
import LlmFactory from '../llms/llm'
import Prompt from '../components/Prompt.vue'
import PromptDefaults from './PromptDefaults.vue'
import MessageItem from '../components/MessageItem.vue'
import MessageItemActionCopy from '../components/MessageItemActionCopy.vue'
import MessageItemActionRead from '../components/MessageItemActionRead.vue'
import ResizableHorizontal from '../components/ResizableHorizontal.vue'
import Generator from '../services/generator'
import Attachment from '../models/attachment'
import Message from '../models/message'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const promptChatTimeout = 1000 * 60 * 1

// load store
store.load()

// init stuff
const generator = new Generator(store.config)
const audioPlayer = useAudioPlayer(store.config)
const llmFactory = new LlmFactory(store.config)

const actionCopy = ref(null)
const prompt = ref(null)
const isMas = ref(false)
const chat: Ref<Chat> = ref(null)
const response: Ref<Message> = ref(null)
const resizerPrompt = ref(null)
const resizerResponse = ref(null)
const audio = ref(null)
const audioState = ref({
  state: 'idle',
  messageId: null,
})

const props = defineProps({
  extra: Object
})

type LastViewed = {
  uuid: string,
  when: number,
}

let llm: LlmEngine = null
let addedToHistory = false
let lastSeenChat: LastViewed = null
let mouseDownToClose = false

onMounted(() => {
  
  // events
  onEvent('send-prompt', onPrompt)
  onEvent('stop-prompting', onStopGeneration)
  window.api.on('show', onShow)

  // audio listener init
  audioPlayer.addListener(onAudioPlayerStatus)
  onEvent('audio-noise-detected', () =>  audioPlayer.stop)

  // shotcuts work better at document level
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('keydown', onKeyDown)  

  // other stuff
  isMas.value = window.api.isMasBuild

  // query params
  window.api.on('query-params', (params) => {
    processQueryParams(params)
  })
  if (props.extra) {
    processQueryParams(props.extra)
  }

})

onUnmounted(() => {
  audioPlayer.removeListener(onAudioPlayerStatus)
  window.api.off('show', onShow)
})

const onShow = () => {

  // see if chat is not that old
  if (chat.value !== null) {
    if (lastSeenChat == null || lastSeenChat.uuid !== chat.value.uuid || lastSeenChat.when < Date.now() - promptChatTimeout) {
      chat.value = null
    } else {
      if (chat.value.messages.length > 1) {
        response.value = chat.value.lastMessage()
      } else {
        response.value = null
      }
    }
  }

  // should we reinit?
  if (chat.value === null) {
    initChat()
  }

  // init llm
  initLlm()

  // focus prompt
  if (prompt.value) {
    prompt.value.setPrompt()
    prompt.value.focus()
  }

}

const initChat = () => {

  // init thread
  chat.value = new Chat()
  chat.value.title = null
  chat.value.addMessage(new Message('system', generator.getSystemInstructions()))

  // reset stuff
  response.value = null
  addedToHistory = false

}

const initLlm = () => {

  // get engine and model
  let engine = store.config.prompt.engine
  let model = store.config.prompt.model
  if (!engine.length || !model.length) {
    ({ engine, model } = llmFactory.getChatEngineModel(false))
  }

  // log
  console.log(`initialize prompt window llm: ${engine} ${model}`)
  
  // init llm with tools
  llm = llmFactory.igniteEngine(engine)
  for (const pluginName in availablePlugins) {
    const pluginClass = availablePlugins[pluginName]
    const instance = new pluginClass(store.config.plugins[pluginName])
    llm.addPlugin(instance)
  }

  // set engine model
  chat.value.setEngineModel(engine, model)

}

const onKeyDown = (ev: KeyboardEvent) => {

  // all this requires we have a response
  if (!response.value) return

  const isCommand = !ev.shiftKey && !ev.altKey && (ev.metaKey || ev.ctrlKey)
  const isShiftCommand = ev.shiftKey && !ev.altKey && (ev.metaKey || ev.ctrlKey)

  // now check
  if (isCommand && ev.key == 'x') {
    ev.preventDefault()
    onClear()
  } else if (isCommand && ev.key == 'c') {
    const selection = window.getSelection()
    if (selection == null || selection.isCollapsed) {
      ev.preventDefault()
      actionCopy.value?.copy()
    }
  } else if (isCommand && ev.key == 's') {
    ev.preventDefault()
    onContinueConversation()
  } else if (isShiftCommand && ev.key == 's') {
    ev.preventDefault()
    saveChat()
  } else if (isCommand && ev.key == 'i') {
    ev.preventDefault()
    onInsert()
  }

}

const onClear = () => {

  // stop generation
  onStopGeneration()

  // keep the first message (instuctions)
  chat.value.messages = chat.value.messages.slice(0, 1)

  // reset response
  response.value = null

  // focus prompt
  if (prompt.value) {
    prompt.value.setPrompt()
    prompt.value.focus()
  }

}

const processQueryParams = (params: anyDict) => {

  // log
  console.log('Processing query params', JSON.stringify(params))

  // auto-fill
  if (params?.foremostApp) {
    const expert = store.experts.find((p) => p.triggerApps?.find((app) => app.identifier == params.foremostApp))
    if (expert) {
      console.log(`Tiggered on ${params.foremostApp}: filling prompt with expert ${expert.name}`)
      setExpertPrompt(expert.id)
    }
  }

}

const setExpertPrompt = (id: string) => {
  const prompt = store.experts.find((p) => p.id == id)
  emitEvent('set-expert-prompt', prompt.prompt)
}

const onKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (prompt.value?.getPrompt()?.length) {
      prompt.value.setPrompt('')
    } else {
      onClose()
    }
  }
}

const onMouseDown = (ev: MouseEvent) => {
  const target = ev.target as HTMLElement
  mouseDownToClose = (target.classList.contains('anywhere') || target.classList.contains('container'))
}

const onMouseUp = (ev: MouseEvent) => {
  if (!mouseDownToClose) return
  const target = ev.target as HTMLElement
  if (target.classList.contains('anywhere') || target.classList.contains('container')) {
    onClose()
  }
}

const cleanUp = () => {
  audioPlayer.stop()
  prompt.value?.setPrompt()
  response.value = null
}

const onClose = () => {

  // save last seen chat
  if (chat.value !== null) {
    lastSeenChat = { uuid: chat.value.uuid, when: Date.now() }
  } else {
    lastSeenChat = null
  }

  // cleanup
  cleanUp()

  // // remove listeners
  // document.removeEventListener('keyup', onKeyUp)
  // document.removeEventListener('keydown', onKeyDown)

  // done
  window.api.anywhere.close()
}

const onStopGeneration = () => {
  generator.stop()
}

const onPrompt = async ({ prompt, attachment, docrepo }: { prompt: string, attachment: Attachment, docrepo: string }) => {

  try {

    // this should not happen but it happens
    if (chat.value === null) {
      initChat()
      initLlm()
    }
    if (llm === null) {
      initLlm()
    }

    // set response
    response.value = new Message('assistant')

    // update thread
    const userMessage = new Message('user', prompt)
    if (attachment) {
      attachment.loadContents()
      userMessage.attach(attachment)
    }
    chat.value.addMessage(userMessage)
    chat.value.addMessage(response.value)

    // now generate
    await generator.generate(llm, chat.value.messages, { model: chat.value.model, attachment, docrepo })

    // save?
    if (store.config.prompt.autosave) {
      saveChat()
    }

  } catch (err) {
    console.error(err)
    response.value.setText('An error occurred while generating the response.')
  }

}

const onInsert = () => {
  if (response.value) {
    window.api.anywhere.insert(response.value.content)
  }
}

const saveChat = async () => {

  // we need a title
  if (!chat.value.title) {
    const title = await llm.complete(chat.value.model, [...chat.value.messages, new Message('user', store.config.instructions.titling_user)])
    chat.value.title = title.content
  }

  // add to history
  if (!addedToHistory) {
    store.chats.push(chat.value)
    addedToHistory = true
  }

  // now save
  store.saveHistory()

}

const onContinueConversation = async () => {

  // make sure it is saved
  await saveChat()

  // continue
  window.api.anywhere.continue(chat.value.uuid)
  cleanUp()

}

const onAudioPlayerStatus = (status: AudioStatus) => {
  audioState.value = { state: status.state, messageId: status.uuid }
}

const onReadAloud = async (message: Message) => {
  await audioPlayer.play(audio.value.$el, message.uuid, message.content)
}

const onSettings = () => {
  document.querySelector<HTMLDialogElement>('#defaults').showModal()
}

const onPromptResize = (deltaX: number) => {
  window.api.anywhere.resize(deltaX, 0)
}

const onResponseResize= (deltaX: number) => {
  window.api.anywhere.resize(deltaX, 0)
}

</script>

<style>

.anywhere {

  .prompt {
    
    .input {
      border: none;
      border-radius: 0px;
      background-color: var(--window-bg-color);
      
      .textarea-wrapper {
        textarea {
          border-radius: 0px;
          background-color: var(--window-bg-color);
          padding: 6px 16px 6px 8px;
          font-size: 16pt;
          &::placeholder {
            opacity: 0.5;
          }
        }
      }
    }
    
    .icon {
      cursor: pointer;
      margin-top: 4px;
      color: var(--prompt-icon-color);
      font-size: 14pt;
    }

    .icon.send, .icon.stop {
      display: none;
    }
  }

  .actions .action {
    -webkit-app-region: no-drag;
  }

  .response {
    .body {
      padding-left: 0px;
      margin-left: 0px;
      p:first-child {
        margin-top: 0px !important;
      }
      p:last-child {
        margin-bottom: 16px;
      }
      a {
        cursor: pointer;
      }
      .transient {
        margin-left: 4px;
        .tool-call {
          font-size: 12pt !important;
        }
      }
    }
  }

}

</style>

<style scoped>

.anywhere {
  height: 100vh;
  padding-left: 64px;
  padding-right: 64px;
  overflow: hidden;
  background-color: transparent;
}

.container {

  --border-radius: 16px;
  
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: start;
  align-items: stretch;

  .prompt {
    -webkit-app-region: drag;
    box-shadow: var(--window-box-shadow);
    background-color: var(--window-bg-color);
    border-radius: var(--border-radius);
    resize: horizontal;
    padding: 10px 16px;
  }

  .prompt * {
    -webkit-app-region: no-drag;
  }

  /* this is to have space between prompt and response */
  /* that does not close the window if clicked */
  .spacer {
    flex: 0 0 32px;
  }

  .response {
    -webkit-app-region: drag;
    box-shadow: var(--window-box-shadow);
    background-color: var(--window-bg-color);
    border-radius: var(--border-radius);
    padding: 32px 0px 16px 32px;
    color: var(--text-color);
    display: flex;
    flex-direction: column;

    .message {
      -webkit-app-region: no-drag;
      overflow-y: auto;
      margin-bottom: 0px;
      padding-bottom: 0px;
      padding-left: 0px;
      max-height: 70vh;
      scrollbar-color: var(--scrollbar-thumb-color) var(--background-color);
    }

    .actions {
      display: flex;
      flex-direction: row;
      gap: 12px;
      padding: 8px 24px 8px 0px;
      padding-bottom: 2px;
      color: var(--icon-color);
      font-size: 10pt;
      cursor: pointer;

      .action {
        display: flex;
        align-items: center;
        svg {
          margin-right: 4px;
        }
        &.insert svg {
          margin-top: 4px;
        }
        &.clear {
          margin-left: auto;
        }
        &.close {
          .narrow {
            border: 1px solid var(--icon-color);
            border-radius: 4px;
            padding: 2px 4px;
            transform: scale(0.65, 0.7);
            margin-right: 0px;
          }
        }
      }
    }

  }

}

</style>
