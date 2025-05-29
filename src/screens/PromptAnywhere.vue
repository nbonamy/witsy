<template>
  <div class="anywhere" @mousedown="onMouseDown" @mouseup="onMouseUp">
    <div class="container" :style="{ top: `calc(${containerTop}px + var(--padding-top))`, left: `${containerLeft}px`, width: `${containerWidth}px` }" >
      <ResizableHorizontal :min-width="500" :resize-elems="false" @resize="onPromptResize">
        <Prompt 
          ref="prompt" 
          :chat="chat" 
          :history-provider="historyProvider" 
          :placeholder="t('common.askMeAnything')" 
          menus-position="below" 
          :enable-doc-repo="false" 
          :enable-attachments="true" 
          :enable-experts="true" 
          :enable-commands="true" 
          :enable-conversations="false"
          @mousedown.stop="onMouseDownPrompt"
        >
          <template #after>
            <div class="app" v-if="sourceApp">
              <img class="icon" :src="iconData" /> {{ t('common.workingWith') }} {{ sourceApp.name }}
            </div>
          </template>
          <template #actions>
            <div class="info" v-if="chat"><span @click="onEngineModel">
              <BIconGlobe /> {{ llmManager.getEngineName(chat.engine) }} / {{ chat.model }}
            </span></div>
          </template>
        </Prompt>
      </ResizableHorizontal>
      <div class="spacer" />
      <ResizableHorizontal :min-width="500" :resize-elems="false" @resize="onResponseResize" v-if="response">
        <OutputPanel ref="output" :message="response" :source-app="showParams?.sourceApp" :show-replace="showReplace" @close="onClose" @clear="onClear" @chat="onChat" @retry="onRetry" @drag="startDrag"/>
      </ResizableHorizontal>
    </div>
  </div>
  <EngineModelPicker ref="engineModelPicker" :engine="chat.engine" :model="chat.model" :disable-streaming="store.config.prompt.disableStreaming" :disable-tools="store.config.prompt.disableTools" @save="onUpdateEngineModel" v-if="chat"/>
</template>

<script setup lang="ts">
import { expertI18n, i18nInstructions, t } from '../services/i18n'
import { anyDict, ExternalApp } from '../types'
import { Ref, ref, computed, onMounted, onUnmounted, provide } from 'vue'
import { store } from '../services/store'
import { availablePlugins } from '../plugins/plugins'
import { LlmEngine } from 'multi-llm-ts'
import { SendPromptParams } from '../components/Prompt.vue'
import ResizableHorizontal from '../components/ResizableHorizontal.vue'
import EngineModelPicker from '../screens/EngineModelPicker.vue'
import LlmFactory, { ILlmManager } from '../llms/llm'
import Prompt from '../components/Prompt.vue'
import OutputPanel from '../components/OutputPanel.vue'
import Generator from '../services/generator'
import Message from '../models/message'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const promptChatTimeout = 1000 * 60 * 5

// load store
store.load()

// init stuff
const generator = new Generator(store.config)
const llmManager: ILlmManager = LlmFactory.manager(store.config)

const prompt = ref(null)
const engineModelPicker: Ref<typeof EngineModelPicker> = ref(null)
const sourceApp: Ref<ExternalApp|null> = ref(null)
const output = ref(null)
const chat: Ref<Chat> = ref(new Chat())
const response: Ref<Message> = ref(null)
const showReplace = ref(false)

const containerTop = ref(0)
const containerLeft = ref(0)
const containerWidth = ref(900)
let isDragging = false
let dragStartX = 0
let dragStartY = 0

let showParams: anyDict = {}
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
  return `data:${sourceApp.value.icon.mimeType};base64,${sourceApp.value.icon.contents}`
})

const historyProvider = () => store.history.quickPrompts

// for reasoning toggling
provide('showReasoning', ref(false))
provide('onToggleReasoning', () => {})

onMounted(() => {
  
  // shortcuts work better at document level
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('keydown', onKeyDown)  

  // events
  onEvent('send-prompt', onSendPrompt)
  onEvent('stop-prompting', onStopGeneration)
  window.api.on('show', onShow)

  // query params
  if (props.extra) {
    processQueryParams(props.extra)
  }

})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  window.api.off('show', onShow)
})

const onShow = (params?: anyDict) => {
  processQueryParams(params)
}

const processQueryParams = (params?: anyDict) => {

  // log
  console.log('Processing query params', JSON.stringify(params))
  showParams = params

  // reset stuff
  hiddenPrompt = null
  sourceApp.value = null
  let userPrompt = null
  let userEngine = null
  let userModel = null
  let userExpert = null

  // replace is easy
  showReplace.value = params?.replace || false

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
  if (params?.sourceApp) {
    for (const expert of store.experts) {
      if (expert.triggerApps?.find((app) => app.identifier == params.sourceApp.id)) {
        console.log(`Triggered on ${params.sourceApp.id}: filling prompt with expert ${expert.name}`)
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
  if (userPrompt?.length && params?.sourceApp) {
    sourceApp.value = window.api.file.getAppInfo(params.sourceApp.path)
    if (sourceApp.value) {
      hiddenPrompt = userPrompt
      userPrompt = null
    }
  }
  
  // see if chat is not that old
  if (chat.value !== null) {
    if (lastSeenChat == null || lastSeenChat.uuid !== chat.value.uuid || lastSeenChat.when < Date.now() - promptChatTimeout) {
      chat.value = null
    } else {
      if (chat.value.hasMessages()) {
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

  // execute
  if (params?.execute) {
    onSendPrompt({ prompt: userPrompt, expert: userExpert, attachments: [], docrepo: null })
    return
  }

  // focus prompt
  if (prompt.value) {
    prompt.value.setPrompt(userPrompt || undefined)
    prompt.value.setExpert(userExpert)
    prompt.value.focus()
  }

}

const onMouseDownPrompt = (event: MouseEvent) => {
  if ((event?.target as HTMLElement)?.classList.contains('actions')) {
    startDrag(event)
  }
}

const startDrag = (event: MouseEvent) => {

  // Only proceed if it's a primary button click (usually left mouse button)
  if (event.button !== 0) return
  
  // Prevent default behavior to avoid text selection during drag
  event.preventDefault()
  
  isDragging = true
  dragStartX = event.clientX - containerLeft.value
  dragStartY = event.clientY - containerTop.value
  
  // Add event listeners for dragging
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (event: MouseEvent) => {
  if (!isDragging) return
  containerLeft.value = event.clientX - dragStartX
  containerTop.value = event.clientY - dragStartY
}

const stopDrag = () => {
  isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const initChat = () => {

  // init thread
  chat.value = new Chat()
  chat.value.title = null
  chat.value.disableStreaming = store.config.prompt.disableStreaming

  // reset stuff
  response.value = null
  addedToHistory = false

}

const initLlm = (engine?: string, model?: string, disableTools?: boolean) => {

  // get engine and model
  engine = engine || store.config.prompt.engine
  model = model || store.config.prompt.model
  disableTools = disableTools || store.config.prompt.disableTools
  if (!engine.length || !model.length) {
    ({ engine, model } = llmManager.getChatEngineModel(false))
  }

  // set engine model
  chat.value.setEngineModel(engine, model)
  store.initChatWithDefaults(chat.value)

  // log
  console.log(`initialize prompt window llm: ${engine} ${model} ${disableTools ? 'without tools' : 'with tools'}`)
  
  // init llm
  llm = llmManager.igniteEngine(engine)

  // tools
  llmManager.loadTools(llm, availablePlugins, disableTools ? [] : null)

}

const onEngineModel = () => {
  engineModelPicker.value.show()
}

const onUpdateEngineModel = (payload: { engine: string, model: string, disableStreaming: boolean, disableTools: boolean }) => {
  const { engine, model, disableStreaming, disableTools } = payload
  if (store.config.prompt.engine === '' && store.config.prompt.model === '') {
    store.config.llm.engine = engine
    store.config.engines[engine].model.chat = model
  } else {
    store.config.prompt.engine = engine
    store.config.prompt.model = model
  }
  store.config.prompt.disableStreaming = disableStreaming
  store.config.prompt.disableTools = disableTools
  store.saveSettings()
  initLlm(engine, model, disableTools)
  if (chat.value) {
    chat.value.disableStreaming = store.config.prompt.disableStreaming
  }
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
    } else if (!prompt.value.isContextMenuOpen() && !document.querySelector('dialog[open]')) {
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
  initLlm()

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
  window.api.anywhere.close(showParams?.sourceApp)
}

const onStopGeneration = () => {
  generator.stop()
}

const onSendPrompt = async (params: SendPromptParams) => {

  try {

    // deconstruct params
    const { prompt, attachments, docrepo, expert } = params
    //console.log('PromptAnywhere.onSendPrompt', prompt, attachment, docrepo, expert)
  
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
    const finalPrompt = hiddenPrompt ? `${hiddenPrompt} ${prompt||''}` : prompt;
    sourceApp.value = null
    hiddenPrompt = null

    // save
    store.addQuickPrompt(finalPrompt)

    // update thread
    const userMessage = new Message('user', finalPrompt)
    userMessage.setExpert(expert, expertI18n(expert, 'prompt'))
    for (const attachment of attachments ?? []) {
      attachment.loadContents()
      userMessage.attach(attachment)
    }
    chat.value.addMessage(userMessage)

    // set response
    response.value = new Message('assistant')
    chat.value.addMessage(response.value)

    // now generate
    await generator.generate(llm, chat.value.messages, {
      ...chat.value.modelOpts,
      model: chat.value.model,
      streaming: !chat.value.disableStreaming,
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
    const model = llmManager.getChatModel(chat.value.engine, chat.value.model)
    const title = await llm.complete(model, [
      ...chat.value.messages,
      new Message('user', i18nInstructions(store.config, 'instructions.titlingUser'))
    ], { tools: false })
    chat.value.title = title.content
  }

  // add to history
  if (!addedToHistory) {
    store.addChat(chat.value)
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

const onRetry = () => {

  // remove response
  chat.value.messages.pop()

  // now pop the prompt
  const lastMessage = chat.value.messages.pop()

  // and retry
  onSendPrompt({
    prompt: lastMessage.content,
    attachments: lastMessage.attachments,
    docrepo: chat.value.docrepo,
    expert: lastMessage.expert
  })

}

const onPromptResize = (deltaX: number) => {
  containerLeft.value += deltaX / 2
  containerWidth.value += deltaX
}

const onResponseResize = (deltaX: number) => {
  containerLeft.value += deltaX / 2
  containerWidth.value += deltaX
}

</script>


<style scoped>

.anywhere {
  
  height: 100vh;
  background-color: transparent;
  -webkit-app-region: no-drag;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: stretch;
}

.container {

  --width-ratio: 2.25;
  --padding-top: 12%;
  --border-radius: 16px;

  position: relative;
  padding-left: 16px;
  padding-right: 16px;
  margin: 0 auto;

  display: flex;
  height: calc(100% - (1.5 * var(--padding-top)));
  flex-direction: column;
  justify-content: start;
  align-items: stretch;
  overflow: hidden;

  .prompt {
    box-shadow: var(--window-box-shadow);
    border-radius: var(--border-radius);
    resize: horizontal;
    padding: 10px 16px;
  }

  /* this is to have space between prompt and response */
  /* that does not close the window if clicked */
  .spacer {
    flex: 0 0 32px;
  }

}

</style>

<style>

.anywhere {

  .prompt, .response {
    opacity: 0.95;
    background-color: var(--anywhere-bg-color);
  }

  @media (prefers-color-scheme: dark) {
    .prompt, .response {
      opacity: 1.0;
    }
  }

  .prompt {

    flex-direction: column-reverse;
    justify-content: start;
    align-items: flex-start;
    padding-left: 12px !important;
    
    .app {
      width: calc(100% - 12px);
      display: flex;
      flex-direction: row;
      background-color: var(--source-app-bg-color);
      color: var(--source-app-text-color);
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

    .actions {
      width: calc(100% - 12px);
      padding: 4px 12px;
      
      .icon {
        margin-right: 8px;
      }
      .info {
        display: flex;
        align-items: flex-end;
        color: var(--prompt-icon-color);
        cursor: pointer;
        opacity: 0.5;
        font-size: 10pt;
        margin-left: auto;
        svg {
          position: relative;
          top: 1px;
          font-size: 10pt;
          margin-right: 0.5rem;
        }
      }
    }

    .input {
      width: 100%;
      border: none;
      border-radius: 0px;
      background-color: var(--anywhere-bg-color);

      .attachment {
        margin-left: 4px;
      }
      
      .textarea-wrapper {
        textarea {
          max-height: 100px;
          border-radius: 0px;
          background-color: var(--anywhere-bg-color);
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

  .response {
    .message {
      max-height: 55vh;
    }
  }

}

.windows .app {
  .icon {
    transform: scale(0.75);
  }
}

dialog#engine-model-picker {
  position: relative;
  top: -30%;
}

@media (prefers-color-scheme: dark) {
  dialog#engine-model-picker::backdrop {
    opacity: 0.35;
  }
}

body.macos dialog#engine-model-picker {
  top: -50%;
}

</style>
