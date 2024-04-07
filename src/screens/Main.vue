<template>
  <div class="main">
    <Sidebar :chat="assistant.chat" v-if="!isStandaloneChat" />
    <ChatArea :chat="assistant.chat" :standalone="isStandaloneChat" />
    <Settings id="settings"/>
  </div>
</template>

<script setup>

// components
import { ref, computed, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import Sidebar from '../components/Sidebar.vue'
import ChatArea from '../components/ChatArea.vue'
import Settings from '../components/Settings.vue'

// bus
import useEventBus from '../composables/useEventBus'
const { onEvent, emitEvent } = useEventBus()

// assistant
import Assistant from '../services/assistant'
const assistant = ref(new Assistant(store.config))

const prompt = ref(null)
const engine = ref(null)
const model = ref(null)
const props = defineProps({
  extra: Object
})

const isStandaloneChat = computed(() => {
  return prompt.value !== null
})

onMounted(() => {
  onEvent('newChat', onNewChat)
  onEvent('selectChat', onSelectChat)
  onEvent('sendPrompt', onSendPrompt)
  onEvent('attachFile', onAttachFile)
  onEvent('detachFile', onDetachFile)
  onEvent('stopAssistant', onStopAssistant)

  // load extra from props
  prompt.value = props.extra?.prompt || null
  engine.value = props.extra?.engine || null
  model.value = props.extra?.model || null

  // init assistant
  if (prompt.value !== null) {
    assistant.value.newChat(false)
    assistant.value.prompt(prompt.value, {
      engine: engine.value,
      model: model.value
    }, (text) => {
     emitEvent('newChunk', text)
    })
  }

})

const onNewChat = () => {
  assistant.value.newChat()
}

const onSelectChat = (chat) => {
  assistant.value.setChat(chat)
  nextTick(() => {
    emitEvent('newChunk')
  })
}

const onSendPrompt = async (prompt) => {

  // make sure we can have an llm
  if (assistant.value.initLlm(store.config.llm.engine) === null) {
    emitEvent('openSettings')
    return
  }

  // prompt
  assistant.value.prompt(prompt, {
    attachment: store.pendingAttachment,
  }, (text) => {
    emitEvent('newChunk', text)
  })

  // clear stuff
  store.pendingAttachment = null
  store.cleanEmptyChats()
}

const onAttachFile = async (file) => {
  store.pendingAttachment = file
}

const onDetachFile = async () => {
  store.pendingAttachment = null
}

const onStopAssistant = async () => {
  await assistant.value.stop()
}

</script>

<style scoped>

.main {
  display: flex;
  flex-direction: row;
  height: 100vh;
}

</style>

