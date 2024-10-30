
<template>
  <div class="anywhere" @click="onClick">
    <div class="container">
      <Prompt ref="prompt" :chat="chat" placeholder="Ask me anything" menus-position="below" :enable-doc-repo="false" :enable-attachments="true" :enable-experts="true" :enable-commands="false" :enable-conversations="false">
        <!-- <BIconSliders class="icon settings" @click="onSettings" /> -->
      </Prompt>
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
          <div class="action clear" @click="onClear">
            <BIconXCircle />  Clear
          </div>
          <div class="action close" @click="onClose">
            <span class="narrow">Esc</span> Close
          </div>
        </div>
      </div>
    </div>
    <audio ref="audio" />
    <PromptDefaults id="defaults" @defaults-modified="initLlm" />
  </div>
</template>

<script setup lang="ts">

import { anyDict } from 'types'
import { ref, onMounted, onUnmounted } from 'vue'
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
import Attachment from 'models/attachment'
import Message from '../models/message'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const promptChatTimeout = 1000 * 60 * 1

// load store
store.load()

// init stuff
const audioPlayer = useAudioPlayer(store.config)
const llmFactory = new LlmFactory(store.config)

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

let llm: LlmEngine = null
let stopGeneration = false
let addedToHistory = false

onMounted(() => {
  
  onEvent('send-prompt', onPrompt)
  onEvent('stop-prompting', onStopGeneration)
  document.addEventListener('keyup', onKeyUp)
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
  window.api.off('show', onShow)
})

const onShow = () => {

  // see if chat is not that old
  if (chat.value !== null) {
    if (chat.value.lastModified < Date.now() - promptChatTimeout) {
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

    // init thread
    chat.value = new Chat()
    chat.value.title = null
    chat.value.addMessage(new Message('system', store.config.instructions.default))

    // reset response
    response.value = null
  
  }

  // init llm
  initLlm()

  // focus prompt
  if (prompt.value) {
    prompt.value.setPrompt()
    prompt.value.focus()
  }

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
    if (prompt.value.getPrompt()?.length) {
      prompt.value.setPrompt('')
    } else {
      onClose()
    }
  }
}

const onClick = (ev: MouseEvent) => {
  const target = ev.target as HTMLElement;
  if (target.classList.contains('anywhere') || target.classList.contains('container')) {
    onClose()
  }
}

const cleanUp = () => {
  audioPlayer.stop()
  prompt.value.setPrompt()
  response.value = null
}

const onClose = () => {
  cleanUp()
  window.api.anywhere.cancel()
}

const onStopGeneration = () => {
  stopGeneration = true
}

const onPrompt = async ({ prompt, attachment, docrepo }: { prompt: string, attachment: Attachment, docrepo: any }) => {

  // set response
  response.value = new Message('assistant', '')
  response.value.setText(null)

  // update thread
  const userMessage = new Message('user', prompt)
  if (attachment) {
    attachment.loadContents()
    userMessage.attach(attachment)
  }
  chat.value.addMessage(userMessage)
  chat.value.addMessage(response.value)

  // now generate
  try {
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
  } catch (err) {
    console.error(err)
    response.value.setText('An error occurred while generating the response.')
  }

  // save?
  if (store.config.prompt.autosave) {
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

    .icon {
      cursor: pointer;
      color: var(--prompt-icon-color);
      margin-left: 4px;
      margin-right: 8px;
    }
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
