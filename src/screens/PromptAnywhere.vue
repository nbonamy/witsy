
<template>
  <div class="anywhere" @mousedown="onMouseDown" @mouseup="onMouseUp">
    <div class="container">
      <ResizableHorizontal :min-width="500" :resize-elems="false" @resize="onPromptResize">
        <Prompt ref="prompt" :chat="chat" placeholder="Ask me anything" menus-position="below" :enable-doc-repo="false" :enable-attachments="true" :enable-experts="true" :enable-commands="false" :enable-conversations="false">
          <template v-slot:after>
            <div class="app" v-if="sourceApp">
              <img class="icon" :src="iconData" /> Working with {{ sourceApp.name }}
            </div>
          </template>
        </Prompt>
      </ResizableHorizontal>
      <div class="spacer" />
      <ResizableHorizontal :min-width="500" :resize-elems="false" @resize="onResponseResize" v-if="response">
        <OutputPanel ref="output" :message="response" @close="onClose" @clear="onClear" @chat="onChat"/>
      </ResizableHorizontal>
    </div>
  </div>
</template>

<script setup lang="ts">

import { anyDict, ExternalApp } from 'types'
import { Ref, ref, computed, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import { availablePlugins } from '../plugins/plugins'
import { LlmEngine } from 'multi-llm-ts'
import { SendPromptParams } from '../components/Prompt.vue'
import ResizableHorizontal from '../components/ResizableHorizontal.vue'
import LlmFactory from '../llms/llm'
import Prompt from '../components/Prompt.vue'
import OutputPanel from '../components/OutputPanel.vue'
import Generator from '../services/generator'
import Attachment from '../models/attachment'
import Message from '../models/message'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const promptChatTimeout = 1000 * 60 * 5

// load store
store.load()

// init stuff
const generator = new Generator(store.config)
const llmFactory = new LlmFactory(store.config)

const prompt = ref(null)
const sourceApp: Ref<ExternalApp|null> = ref(null)
const output = ref(null)
const chat: Ref<Chat> = ref(null)
const response: Ref<Message> = ref(null)

const props = defineProps({
  extra: Object
})

type LastViewed = {
  uuid: string,
  when: number,
}

let llm: LlmEngine = null
let hiddenPrompt: string|null = null
let addedToHistory = false
let lastSeenChat: LastViewed = null
let mouseDownToClose = false

const iconData = computed(() => {
  const iconContents = window.api.file.readIcon(sourceApp.value.icon)
  return `data:${iconContents.mimeType};base64,${iconContents.contents}`
})

onMounted(() => {
  
  // events
  onEvent('send-prompt', onSendPrompt)
  onEvent('stop-prompting', onStopGeneration)
  window.api.on('show', onShow)

  // shotcuts work better at document level
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('keydown', onKeyDown)  

})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  window.api.off('show', onShow)
})

const onShow = (params?: anyDict) => {

  // log
  console.log('Processing query params', JSON.stringify(params))

  // reset stuff
  hiddenPrompt = null
  let userPrompt = null
  let userEngine = null
  let userModel = null
  let userExpert = null

  // auto-select prompt
  if (params?.promptId) {
    userPrompt = window.api.automation.getText(params.promptId)
    if (userPrompt?.length) {
      console.log(`Triggered with prompt: ${userPrompt.replaceAll('\n', '').substring(0, 50)}...`)
      userEngine = params.engine
      userModel = params.model
    } else {
      console.error(`Prompt with id ${params.promptId} not found`)
    }
  }

  // auto-select expert
  if (params?.foremostApp) {
    for (const expert of store.experts) {
      if (expert.triggerApps?.find((app) => app.identifier == params.foremostApp)) {
        console.log(`Triggered on ${params.foremostApp}: filling prompt with expert ${expert.name}`)
        userExpert = expert
        break
      }
    }
  }

  // if we have a user prompt we start over
  if (userPrompt?.length) {
    chat.value = null
    response.value = null
  }

  // source app
  if (params?.sourceApp?.length) {
    sourceApp.value = window.api.file.getAppInfo(params.sourceApp)
    hiddenPrompt = userPrompt
    userPrompt = null
  }
  
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
  initLlm(userEngine, userModel)

  // focus prompt
  if (prompt.value) {
    prompt.value.setPrompt(userPrompt || undefined)
    prompt.value.setExpert(userExpert)
    prompt.value.focus()
  }

}

const initChat = () => {

  // init thread
  chat.value = new Chat()
  chat.value.title = null

  // reset stuff
  response.value = null
  addedToHistory = false

}

const initLlm = (engine?: string, model?: string) => {

  // get engine and model
  engine = engine || store.config.prompt.engine
  model = model || store.config.prompt.model
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
  /*if (isCommand && ev.key == 'x') {
    ev.preventDefault()
    onClear()
  } else if (isCommand && ev.key == 's') {
    ev.preventDefault()
    onChat()
  } else */if (isShiftCommand && ev.key == 's') {
    ev.preventDefault()
    saveChat()
  }

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
  prompt.value?.setPrompt()
  output.value?.cleanUp()
  response.value = null
}

const onClear = () => {

  // stop generation
  onStopGeneration()

  // reset all messages
  initChat()

  // reset response
  output.value?.cleanUp()
  response.value = null

  // focus prompt
  if (prompt.value) {
    prompt.value.setPrompt()
    prompt.value.focus()
  }

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

const onSendPrompt = async (params: SendPromptParams) => {

  try {

    // deconstruct params
    const { prompt, attachment, docrepo, expert } = params
  
    // this should not happen but it happens
    if (chat.value === null) {
      initChat()
      initLlm()
    }
    if (llm === null) {
      initLlm()
    }

    // system instructions
    if (chat.value.messages.length === 0) {
      const systemInstructions = generator.getSystemInstructions()
      chat.value.addMessage(new Message('system', systemInstructions))
    }

    // final prompt
    const finalPrompt = hiddenPrompt ? `${hiddenPrompt} ${prompt}` : prompt;
    sourceApp.value = null
    hiddenPrompt = null

    // update thread
    const userMessage = new Message('user', finalPrompt)
    userMessage.expert = expert
    if (attachment) {
      attachment.loadContents()
      userMessage.attach(attachment)
    }
    chat.value.addMessage(userMessage)

    // set response
    response.value = new Message('assistant')
    chat.value.addMessage(response.value)

    // now generate
    await generator.generate(llm, chat.value.messages, {
      model: chat.value.model,
      docrepo: docrepo,
      sources: true,
    })

    // save?
    if (store.config.prompt.autosave) {
      saveChat()
    }

  } catch (err) {
    console.error(err)
    response.value.setText('An error occurred while generating the response.')
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

const onChat = async () => {

  // make sure it is saved
  await saveChat()
  
  // continue
  window.api.chat.open(chat.value.uuid)
  onClose()

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

    flex-direction: column-reverse;
    justify-content: start;
    align-items: flex-start;
    padding-left: 12px !important;
    
    .app {
      width: calc(100% - 12px);
      display: flex;
      flex-direction: row;
      background-color: black;
      color: var(--window-bg-color);
      border-radius: 8px;
      align-items: center;
      padding: 2px 8px;
      margin-bottom: 8px;
      font-size: 11pt;
      font-weight: 500;
      .icon {
        padding: 0px;
        margin: 0px;
        width: 28px;
        height: 28px;
        margin-right: 4px;
      }
    }

    @media (prefers-color-scheme: dark) {
      .app {
        background-color: white;
      }
    }

    .actions {
      padding: 4px 12px;
    }

    .input {
      width: 100%;
      border: none;
      border-radius: 0px;
      background-color: var(--window-bg-color);

      .attachment {
        margin-left: 4px;
      }
      
      .textarea-wrapper {
        textarea {
          max-height: 100px;
          border-radius: 0px;
          background-color: var(--window-bg-color);
          padding: 6px 16px 6px 8px;
          font-size: 16pt;
          &::placeholder {
            opacity: 0.5;
          }
        }

        .icon.left {
          position: static;
          margin: 4px 0px 0px 8px;
          color: var(--text-color);
          
          svg {
            font-size: 14pt;
            height: auto;
          }
        }

        .icon.left + textarea {
          padding-left: 16px;
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

}

</style>
