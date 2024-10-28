
<template>
  <div class="anywhere" @click="onClick">
    <div class="container">
      <Prompt ref="prompt" :chat="chat" menus-position="below" :enable-doc-repo="false" :enable-attachments="false" :enable-experts="true" :enable-commands="false" :enable-conversations="false" />
      <div class="spacer" />
      <div class="response messages openai size4" v-if="response">
        <MessageItem :message="response" :show-role="false" :show-actions="false"/>
        <div class="actions">
          <MessageItemActionCopy :message="response" />
          <div class="action insert" v-if="!isMas && !response.transient" @click="onInsert">
            <BIconArrowReturnLeft /> Insert
          </div>
          <MessageItemActionRead :message="response" :audio-state="audioState" :read-aloud="onReadAloud" />
          <div class="action continue" v-if="!response.transient" @click="onContinueConversation">
            <BIconBoxArrowInUpRight /> Open as Chat
          </div>
          <div class="action close" @click="onClose">
            <span class="narrow">Esc</span> Close
          </div>
        </div>
      </div>
    </div>
    <audio ref="audio" />
  </div>
</template>

<script setup>

import { ref, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import { igniteEngine, getChatEngineModel } from '../llms/llm'
import { availablePlugins } from '../plugins/plugins'
import useAudioPlayer from '../composables/audio_player'
import Prompt from '../components/Prompt.vue'
import MessageItem from '../components/MessageItem.vue'
import MessageItemActionCopy from '../components/MessageItemActionCopy.vue'
import MessageItemActionRead from '../components/MessageItemActionRead.vue'
import Message from '../models/message'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const promptChatTimeout = 1000 * 60 * 1

// load store
store.load()

// init stuff
const audioPlayer = useAudioPlayer(store.config)

const prompt = ref(null)
const isMas = ref(false)
const chat = ref(null)
const response = ref(null)
const audio = ref(null)
const audioState = ref({
  state: 'idle',
  messageId: null,
})

const props = defineProps({
  extra: Object
})

let llm = null
let stopGeneration = false
let addedToHistory = false

onMounted(() => {
  
  onEvent('send-prompt', onPrompt)
  onEvent('prompt-resize', onResize)
  onEvent('show-experts', onExperts)
  onEvent('stop-prompting', onStopGeneration)
  document.addEventListener('keyup', onKeyUp)
  window.api.on('set-expert-prompt', onSetExpertPrompt)
  window.api.on('show', onShow)

  // audio listener init
  audioPlayer.addListener(onAudioPlayerStatus)
  onEvent('audio-noise-detected', () =>  audioPlayer.stop)

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
  document.removeEventListener('keyup', onKeyUp)
  audioPlayer.removeListener(onAudioPlayerStatus)
  window.api.off('set-expert-prompt', onSetExpertPrompt)
  window.api.off('show', onShow)
})

const onShow = () => {

  // log
  console.log('initialize prompt window llm')

  // get engine and model
  const { engine, model } = getChatEngineModel(false)
  
  // init llm with tools
  llm = igniteEngine(engine)
  for (const pluginName in availablePlugins) {
    const pluginClass = availablePlugins[pluginName]
    const instance = new pluginClass(store.config.plugins[pluginName])
    llm.addPlugin(instance)
  }

  // see if chat is not that old
  if (chat.value !== null) {
    if (chat.value.lastModified < Date.now() - promptChatTimeout) {
      chat.value = null
    } else {
      response.value = chat.value.lastMessage()
    }
  }

  // should we reinit?
  if (chat.value === null) {

    // init thread
    chat.value = new Chat()
    chat.value.title = null
    chat.value.setEngineModel(engine, model)
    chat.value.addMessage(new Message('system', store.config.instructions.default))

    // reset response
    response.value = null
  
  }

  // focus prompt
  if (prompt.value) {
    prompt.value.setPrompt()
    prompt.value.focus()
  }

}

const processQueryParams = (params) => {

  // log
  console.log('Processing query params', JSON.stringify(params))

  // auto-fill
  if (params?.foremostApp) {
    const expert = store.experts.find((p) => p.triggerApps?.find((app) => app.identifier == params.foremostApp))
    if (expert) {
      console.log(`Tiggered on ${params.foremostApp}: filling prompt with expert ${expert.name}`)
      onSetExpertPrompt(expert.id)
    }
  }

}

const onSetExpertPrompt = (id) => {
  const prompt = store.experts.find((p) => p.id == id)
  emitEvent('set-expert-prompt', prompt.prompt)
}

const onResize = (data) => {
  const height = parseInt(data) + 18
  //window.api.anywhere.resize(height)
}

const onExperts = () => {
  if (!window.api.anywhere.isExpertsOpen()) {
    window.api.anywhere.showExperts()
  }
}

const onKeyUp = (event) => {
  if (event.key === 'Escape') {
    onClose()
  }
}

const onClick = (ev) => {
  if (ev.target.classList.contains('anywhere') || ev.target.classList.contains('container')) {
    onClose()
  }
}

const cleanUp = () => {
  audioPlayer.stop()
  response.value = null
}

const onClose = () => {
  cleanUp()
  window.api.anywhere.cancel()
}

const onStopGeneration = () => {
  stopGeneration = true
}

const onPrompt = async (data) => {

  // set response
  response.value = new Message('assistant', '')
  response.value.setText(null)

  // update thread
  chat.value.addMessage(new Message('user', data))
  chat.value.addMessage(response.value)

  // now generate
  stopGeneration = false
  const stream = await llm.generate(chat.value.messages.slice(0, -1), { model: chat.value.model })
  for await (const msg of stream) {
    if (stopGeneration) {
      llm.stop(stream)
      break
    }
    if (msg.type === 'tool') {
      response.value.setToolCall(msg.text)
    } else if (msg.type === 'content') {
      response.value.appendText(msg)
    }
  }

  // save?
  if (store.config.general.autoSavePrompt) {
    saveChat()
  }

}

const onInsert = () => {
  window.api.anywhere.insert(response.value.content)
}

const saveChat = async () => {

  // we need a title
  if (!chat.value.title) {
    const title = await llm.complete([...chat.value.messages, new Message('user', store.config.instructions.titling_user)])
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
  cleanUp()
  window.api.anywhere.continue(chat.value.uuid)

}

const onAudioPlayerStatus = (status) => {
  audioState.value = { state: status.state, messageId: status.uuid }
}

const onReadAloud = async (message) => {
  await audioPlayer.play(audio.value.$el, message.uuid, message.content)
}

</script>

<style scoped>

.anywhere {
  height: 75vh;
  padding-top: 15vh;
  padding-bottom: 10vh;
  padding-left: 10vw;
  padding-right: 10vw;
  overflow: hidden;
  background-color: transparent;
}

.container {
  
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: start;
  align-items: stretch;

  .prompt {
    box-shadow: var(--window-box-shadow);
    background-color: var(--window-bg-color);
    border-radius: 12px;
  }

  .prompt, .prompt * {
    font-size: 14pt;
  }

  /* this is to have space between prompt and response */
  /* that does not close the window if clicked */
  .spacer {
    height:32px;
  }

  .response {
    box-shadow: var(--window-box-shadow);
    background-color: var(--window-bg-color);
    border-radius: 12px;
    padding: 16px 0px;
    color: var(--text-color);
    display: flex;
    flex-direction: column;

    .message {
      overflow-y: auto;
      margin-bottom: 0px;
      padding-bottom: 0px;
      max-height: 60vh;
      scrollbar-color: var(--scrollbar-thumb-color) var(--background-color);

      p:last-child() {
        margin-bottom: 0px;
      }
    }

    .actions {
      display: flex;
      flex-direction: row;
      gap: 12px;
      padding: 8px 32px;
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
        &.close {
          margin-left: auto;
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
