<template>
  <div class="anywhere" @mousedown="onMouseDown" @mouseup="onMouseUp">
    <div class="container" :style="{ top: `calc(${containerTop}px + var(--padding-top))`, left: `${containerLeft}px`, width: `${containerWidth}px` }" >
      <ResizableHorizontal :min-width="500" :resize-elems="false" @resize="onPromptResize">
        
        <Prompt
          ref="prompt" 
          :chat="chat" 
          :history-provider="historyProvider" 
          :placeholder="t('common.askMeAnything')" 
          :enable-doc-repo="false" 
          :enable-attachments="true" 
          :enable-experts="true" 
          :enable-commands="true" 
          :enable-conversations="false"
          menus-position="below" 
          @mousedown.stop="onMouseDownPrompt"
          @set-engine-model="onUpdateEngineModel"
          @tools-updated="onToolsUpdated"
          @prompt="onSendPrompt"
          @stop="onStopGeneration"
        >
          <template #before>
            <div class="app" v-if="sourceApp">
              <img class="icon" :src="iconData" /> {{ t('common.workingWith') }} {{ sourceApp.name }}
            </div>
          </template>
        </Prompt>
      </ResizableHorizontal>
      <div class="spacer" />
      <ResizableHorizontal :min-width="500" :resize-elems="false" @resize="onResponseResize" v-if="response">
        <OutputPanel ref="output" :message="response" :source-app="showParams?.sourceApp" :show-replace="showReplace" @close="onClose" @clear="onClear" @chat="onChat" @retry="onRetry" @drag="startDrag"/>
      </ResizableHorizontal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LlmEngine } from 'multi-llm-ts'
import { anyDict, ExternalApp } from 'types'
import { CodeExecutionMode } from 'types/config'
import { ToolSelection } from 'types/llm'
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import Chat from '@models/chat'
import Message from '@models/message'
import OutputPanel from '@components/OutputPanel.vue'
import Prompt, { SendPromptParams } from '@components/Prompt.vue'
import ResizableHorizontal from '@components/ResizableHorizontal.vue'
import useEventListener from '@composables/event_listener'
import useIpcListener from '@composables/ipc_listener'
import Generator from '@services/generator'
import { fullExpertI18n, i18nInstructions, t } from '@services/i18n'
import LlmUtils from '@services/llm_utils'
import LlmFactory, { ILlmManager } from '@services/llms/llm'
import { availablePlugins } from '@services/plugins/plugins'
import { store } from '@services/store'

const { onDomEvent, offDomEvent } = useEventListener()
const { onIpcEvent } = useIpcListener()

const promptChatTimeout = 1000 * 60 * 5

// load store
store.load()

// init stuff
const generator = new Generator(store.config)
const llmManager: ILlmManager = LlmFactory.manager(store.config)
let abortController: AbortController | null = null

const prompt = ref<typeof Prompt>(null)
const sourceApp = ref<ExternalApp | null>(null)
const output = ref(null)
const chat = ref<Chat>(null)
const response = ref<Message>(null)
const showReplace = ref(false)
const processing = ref(false)

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

  // init chat
  initChat()

  // shortcuts work better at document level
  onDomEvent(document, 'keyup', onKeyUp)
  onDomEvent(document, 'keydown', onKeyDown)

  // events
  onIpcEvent('start-dictation', onDictate)
  onIpcEvent('show', onShow)

  // query params
  if (props.extra) {
    processQueryParams(props.extra)
  }

})

onBeforeUnmount(() => {
  // DOM and IPC listeners are cleaned up by composables
})

const onShow = (params?: anyDict) => {
  processQueryParams(params)
}

const onDictate = () => {
  prompt.value?.startDictation()
}

const processQueryParams = (params?: anyDict) => {

  // log
  console.log('[anywr] Processing query params', JSON.stringify(params))
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
      console.log(`[anywr] Triggered with prompt: ${userPrompt.replaceAll('\n', '').substring(0, 50)}...`)
      userEngine = params.engine
      userModel = params.model
    } else {
      console.error(`[anywr] Prompt with id ${params.promptId} not found`)
    }
  }

  // auto-select expert
  if (params?.sourceApp) {
    for (const expert of store.experts) {
      if (expert.state === 'enabled' && expert.triggerApps?.find((app) => app.identifier == params.sourceApp.id)) {
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
    onSendPrompt({ prompt: userPrompt, expert: userExpert })
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
  onDomEvent(document, 'mousemove', onDrag)
  onDomEvent(document, 'mouseup', stopDrag)
}

const onDrag = (event: Event) => {
  if (!isDragging) return
  const mouseEvent = event as MouseEvent
  containerLeft.value = mouseEvent.clientX - dragStartX
  containerTop.value = mouseEvent.clientY - dragStartY
}

const stopDrag = () => {
  isDragging = false
  offDomEvent(document, 'mousemove', onDrag)
  offDomEvent(document, 'mouseup', stopDrag)
}

const initChat = () => {

  // init thread
  chat.value = new Chat()
  chat.value.title = null
  chat.value.disableStreaming = store.config.prompt.disableStreaming
  chat.value.tools = store.config.prompt.tools

  // reset stuff
  response.value = null
  addedToHistory = false

}

const initLlm = (engine?: string, model?: string) => {

  // get engine and model
  engine = engine || store.config.prompt.engine
  model = model || store.config.prompt.model
  if (!engine.length || !model.length) {
    ({ engine, model } = llmManager.getChatEngineModel(false))
  }

  // set engine model
  chat.value.setEngineModel(engine, model)
  store.initChatWithDefaults(chat.value)
  chat.value.disableStreaming = store.config.prompt.disableStreaming
  chat.value.tools = store.config.prompt.tools

  // log
  console.log(`[anywr] Initialize prompt window llm: ${engine} ${model}`)

  // init llm
  llm = llmManager.igniteEngine(engine)

}

const onUpdateEngineModel = (engine: string, model: string) => {
  if (store.config.prompt.engine === '' && store.config.prompt.model === '') {
    store.config.llm.engine = engine
    store.config.engines[engine].model.chat = model
  } else {
    store.config.prompt.engine = engine
    store.config.prompt.model = model
  }
  store.saveSettings()
  initLlm(engine, model)
}

const onToolsUpdated = (tools: ToolSelection) => {
  store.config.prompt.tools = tools
  store.saveSettings()
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
  } else */if (isShiftCommand && ev.key.toLocaleLowerCase() == 's') {
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
  abortController?.abort()
}

const onSendPrompt = async (params: SendPromptParams) => {

  try {

    // set
    processing.value = true

    // deconstruct params
    const { instructions, prompt, attachments, docrepos, expert } = params
    //console.log('PromptAnywhere.onSendPrompt', prompt, attachment, docrepo, expert)
  
    // this should not happen but it happens
    if (chat.value === null) {
      initChat()
      initLlm()
    }
    if (llm === null) {
      initLlm()
    }

    // load tools as configured per prompt
    const codeExecutionMode: CodeExecutionMode = store.config.llm.codeExecution
    llmManager.loadTools(llm, store.config.workspaceId, availablePlugins, chat.value.tools, { codeExecutionMode })

    // system instructions
    const llmUtils = new LlmUtils(store.config)
    const systemInstructions = llmUtils.getSystemInstructions(instructions, { codeExecutionMode })
    if (chat.value.messages.length === 0) {
      chat.value.addMessage(new Message('system', systemInstructions))
    } else if (instructions) {
      chat.value.messages[0].content = systemInstructions
    }

    // final prompt
    const finalPrompt = hiddenPrompt ? `${hiddenPrompt} ${prompt||''}` : prompt;
    sourceApp.value = null
    hiddenPrompt = null

    // save
    store.addQuickPrompt(finalPrompt)

    // update thread
    const userMessage = new Message('user', finalPrompt)
    userMessage.setExpert(fullExpertI18n(expert))
    for (const attachment of attachments ?? []) {
      await attachment.loadContents()
      userMessage.attach(attachment)
    }
    chat.value.addMessage(userMessage)

    // set response
    response.value = new Message('assistant')
    chat.value.addMessage(response.value)

    // create abort controller
    abortController = new AbortController()

    // now generate
    await generator.generate(llm, chat.value.messages, {
      ...chat.value.modelOpts,
      model: chat.value.model,
      streaming: !chat.value.disableStreaming,
      docrepos: docrepos,
      sources: true,
      abortSignal: abortController.signal,
    })

    // save?
    if (store.config.prompt.autosave) {
      saveChat()
    }

    // command action
    if (showParams?.action === 'copy') {
      output.value.onCopy()
      onClose()
    } else if (showParams?.action === 'insert') {
      output.value.onInsert()
    } else if (showParams?.action === 'replace') {
      output.value.onReplace()
    }

  } catch (err) {

    console.error(err)
    response.value.setText('An error occurred while generating the response.')
  
  } finally {

    processing.value = false
    
  }

}

const saveChat = async () => {

  // we need a title
  if (!chat.value.title) {
    const model = llmManager.getChatModel(chat.value.engine, chat.value.model)
    const title = await llm.complete(model, [
      ...chat.value.messages,
      new Message('user', i18nInstructions(store.config, 'instructions.utils.titlingUser'))
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
    instructions: chat.value.instructions,
    prompt: lastMessage.content,
    attachments: lastMessage.attachments,
    docrepos: chat.value.docrepos,
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

  .container {

    --width-ratio: 2.25;
    --padding-top: 12%;
    --radius-sm: 16px;

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
      border-radius: var(--radius-sm);
      resize: horizontal;
      padding: 1rem 1.25rem;
    }

    /* this is to have space between prompt and response */
    /* that does not close the window if clicked */
    .spacer {
      flex: 0 0 32px;
    }

  }

}

</style>

<style>

.anywhere {

  .prompt, .response {
    opacity: 0.98;
    background-color: var(--anywhere-bg-color);
  }

  @media (prefers-color-scheme: dark) {
    .prompt, .response {
      opacity: 1.0;
    }
  }

  .prompt {

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
      font-size: 14.5px;
      font-weight: var(--font-weight-medium);
      .icon {
        padding: 0px;
        margin: 0px;
        width: 28px;
        height: 28px;
        margin-right: 4px;
      }
    }

    .attachments {
      padding-left: 0.25rem;
      .attachment {
        opacity: 0.8;
        border-color: color-mix(in srgb, var(--prompt-input-border-color), var(--text-color) 50%);
      }
    }

    .input {

      .textarea-wrapper {
        textarea {
          max-height: 100px;
          background-color: var(--anywhere-bg-color);
          padding: 6px 16px 6px 8px;
          font-size: 22px;
          &::placeholder {
            opacity: 0.5;
          }
        }

        .icon.left {
          margin: 4px 0px 0px 8px !important;
          svg {
            font-size: 18.5px;
            height: auto;
          }
        }

      }
    }
    
    .actions {
      
      width: calc(100% - 0.75rem);
      padding: 0 0 0.5rem 0.5rem;
      margin-top: 0.25rem;
      
      .icon.instructions {
        margin-top: 4.5px;
        margin-right: 8px;
      }
      
      .info {
        display: flex;
        align-items: flex-end;
        color: var(--prompt-icon-color);
        cursor: pointer;
        opacity: 0.5;
        font-size: 13.5px;
        margin-left: auto;
        svg {
          position: relative;
          top: 1px;
          font-size: 13.5px;
          margin-right: 0.5rem;
        }
      }
    }

    .icon {
      cursor: pointer;
      color: var(--prompt-icon-color);
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
