
<template>
  <div class="command" @mousedown="onMouseDown" @mouseup="onMouseUp">
    <div class="container">
      <ResizableHorizontal :min-width="500" :resize-elems="false" @resize="onResponseResize">
        <OutputPanel ref="output" :message="response" :allow-direct-keys="true" :show-replace="true" :show-clear="false" @close="onClose" @chat="onChat" v-if="response" />
      </ResizableHorizontal>
    </div>
  </div>
</template>

<script setup lang="ts">

import { anyDict } from 'types'
import { Ref, ref, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import { availablePlugins } from '../plugins/plugins'
import { LlmEngine } from 'multi-llm-ts'
import { SendPromptParams } from '../components/Prompt.vue'
import useTipsManager from '../composables/tips_manager'
import ResizableHorizontal from '../components/ResizableHorizontal.vue'
import LlmFactory from '../llms/llm'
import Prompt from '../components/Prompt.vue'
import OutputPanel from '../components/OutputPanel.vue'
import Generator from '../services/generator'
import Message from '../models/message'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

// load store
store.load()

// init stuff
const generator = new Generator(store.config)
const llmFactory = new LlmFactory(store.config)
const tipsManager = useTipsManager(store)

const output = ref(null)
const chat: Ref<Chat|null> = ref(null)
const response: Ref<Message|null> = ref(null)

const props = defineProps({
  extra: Object
})

let llm: LlmEngine = null
let mouseDownToClose = false

onMounted(() => {
  
  // shotcuts work better at document level
  document.addEventListener('keyup', onKeyUp)

  // query params
  if (props.extra) {
    processQueryParams(props.extra)
  } else {
    window.api.commands.closeResult()
  }

})

onUnmounted(() => {
  document.removeEventListener('keyup', onKeyUp)
})

const initLlm = (engine: string, model: string) => {

  // log
  console.log(`initialize command result llm: ${engine} ${model}`)
  
  // init llm with tools
  llm = llmFactory.igniteEngine(engine)
  for (const pluginName in availablePlugins) {
    const pluginClass = availablePlugins[pluginName]
    const instance = new pluginClass(store.config.plugins[pluginName])
    llm.addPlugin(instance)
  }

}

const onClear = () => {

  // stop generation
  generator.stop()

  // reset response
  output.value?.cleanUp()
  response.value = null

}

const processQueryParams = (params: anyDict) => {

  // log
  console.log('Processing query params', JSON.stringify(params))

  // get data
  const prompt = window.api.automation.getText(params.promptId)
  const engine = params.engine
  const model = params.model

  // log
  //console.log(`Command result prompt: ${prompt}`)

  // and run it
  if (prompt) {
    sendPrompt(prompt, engine, model)
  }

}

const onKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    onClose()
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
  output.value?.cleanUp()
}

const onClose = () => {

  // cleanup
  cleanUp()

  // done
  window.api.commands.closeResult()
}

const onChat = async () => {

  // we need a title
  if (!chat.value.title) {
    const title = await llm.complete(chat.value.model, [...chat.value.messages, new Message('user', store.config.instructions.titling_user)])
    chat.value.title = title.content
  }

  // add to history
  store.chats.push(chat.value)
  store.saveHistory()

  // continue
  window.api.chat.open(chat.value.uuid)
  cleanUp()

}

const sendPrompt = async (prompt, engine, model) => {

  try {

    // init llm
    initLlm(engine, model)

    // init a chat
    chat.value = new Chat()
    chat.value.title = null
    chat.value.setEngineModel(engine, model)
    const systemInstructions = generator.getSystemInstructions()
    chat.value.addMessage(new Message('system', systemInstructions))

    // update thread
    const userMessage = new Message('user', prompt)
    chat.value.addMessage(userMessage)

    // set response
    response.value = new Message('assistant')
    chat.value.addMessage(response.value)

    // now generate
    await generator.generate(llm, chat.value.messages, {
      model: chat.value.model,
    })

    // show tip
    if (tipsManager.isTipAvailable('newCommand')) {
      tipsManager.showTip('newCommand')
    }

  } catch (err) {
    console.error(err)
    response.value.setText('An error occurred while generating the response.')
  }

}

const onResponseResize = (deltaX: number) => {
  window.api.commands.resizeResult(deltaX, 0)
}

</script>

<style scoped>

.command {
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

}

</style>
