<template>
  <div class="main">
    <Sidebar :chat="assistant.chat" v-if="!isStandaloneChat" />
    <ChatArea :chat="assistant.chat" :standalone="isStandaloneChat" />
    <Settings id="settings" />
    <DocRepos />
  </div>
</template>

<script setup>

// components
import Swal from 'sweetalert2/dist/sweetalert2.js'
import { ref, computed, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import { download, saveFileContents } from '../services/download'
import useTipsManager from '../composables/tips_manager'
import Sidebar from '../components/Sidebar.vue'
import ChatArea from '../components/ChatArea.vue'
import DocRepos from './DocRepos.vue'
import Settings from './Settings.vue'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

// init stuff
store.load()
const tipsManager = useTipsManager(store)

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

  // events
  onEvent('new-chat', onNewChat)
  onEvent('rename-chat', onRenameChat)
  onEvent('delete-chat', onDeleteChat)
  onEvent('select-chat', onSelectChat)
  onEvent('send-prompt', onSendPrompt)
  onEvent('attach-file', onAttachFile)
  onEvent('detach-file', onDetachFile)
  onEvent('stop-assistant', onStopAssistant)

  // other
  store.addListener({
    onStoreUpdated(domain) {
      if (domain === 'config') {
        onConfigUpdated()
      }
    }
  })

  // load extra from props
  if (props.extra?.promptId) {

    // load extra
    prompt.value = window.api.commands.getPrompt(props.extra?.promptId) || null
    engine.value = props.extra?.engine || null
    model.value = props.extra?.model || null

    // special commands are not executed
    const execute = !(props.extra?.execute === false || props.extra?.execute === 'false')

    // execute or not
    if (prompt.value !== null) {
      if (execute) {
        assistant.value.prompt(prompt.value, {
          engine: engine.value,
          model: model.value,
          save: false,
        }, (chunk) => {
          emitEvent('new-llm-chunk', chunk)
        })
      } else {
        emitEvent('set-prompt', { content: prompt.value })
      }
    }

  }

  // open settings
  if (props.extra?.settings) {
    emitEvent('open-settings')
  }

  // intercept links
  document.addEventListener('click', (e) => {
    const target = e.target || e.srcElement
    const href = target.getAttribute('href')
    if (href?.startsWith('#settings')) {
      emitEvent('open-settings', { initialTab: href.split('_')[1] })
      e.preventDefault()
      return false
    }
  })

  // show tips
  tipsManager.showNextTip()

})

const onNewChat = () => {
  onSelectChat(null)
}

const onSelectChat = (chat) => {
  // create a new assistant to allow parallel querying
  // this will be garbage collected anyway
  store.pendingDocRepo = null
  assistant.value = new Assistant(store.config)
  assistant.value.setChat(chat)
  nextTick(() => {
    emitEvent('new-llm-chunk')
  })
}

const onRenameChat = async (chat) => {
  // prompt
  const { value: title } = await Swal.fire({
    title: 'Rename Chat',
    input: 'text',
    inputValue: chat.title,
    showCancelButton: true,
  });
  if (title) {
    chat.title = title
    store.saveHistory()
  }
}

const onDeleteChat = async (chat) => {

  const chats = Array.isArray(chat) ? chat : [chat]
  const title = chats.length > 1
    ? 'Are you sure you want to delete these conversations? This cannot be undone.'
    : 'Are you sure you want to delete this conversation? This cannot be undone.'

  Swal.fire({
    target: document.querySelector('.main'),
    title: title,
    confirmButtonText: 'Delete',
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {

      // fist remove
      if (isStandaloneChat.value) {
        chat.deleted = true
        store.saveHistory()
      } else {
        for (const chat of chats) {
          let index = store.chats.findIndex((c) => c.uuid === chat)
          store.chats[index].delete()
          store.chats.splice(index, 1)
        }
        store.saveHistory()
      }

      // if current chat
      if (chats.includes(assistant.value.chat?.uuid)) {
        emitEvent('new-chat')
      }

      // close window if standalone
      if (isStandaloneChat.value) {
        window.close()
      }

    }
  })
}

const onSendPrompt = async (prompt) => {

  // make sure we can have an llm
  assistant.value.initLlm(store.config.llm.engine)
  if (!assistant.value.hasLlm()) {
    nextTick(() => emitEvent('open-settings', { initialTab: 'models' }))
    return
  }

  // save the attachment
  if (store.pendingAttachment?.downloaded === false) {
    let fileUrl = null
    if (store.pendingAttachment.url === 'clipboard://') {
      fileUrl = saveFileContents(store.pendingAttachment.format(), store.pendingAttachment.contents)
    } else {
      fileUrl = download(store.pendingAttachment.url)
    }
    if (fileUrl) {
      store.pendingAttachment.downloaded = true
      store.pendingAttachment.url = fileUrl
    }
  }

  // prompt
  assistant.value.prompt(prompt, {
    ...(engine.value && { engine: engine.value }),
    ...(model.value && { model: model.value }),
    attachment: store.pendingAttachment,
    docrepo: store.pendingDocRepo,
  }, (chunk) => {
    emitEvent('new-llm-chunk', chunk)
  })

  // clear stuff
  store.pendingAttachment = null
  store.pendingDocRepo = null

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

const onConfigUpdated = async () => {
  assistant.value.setConfig(store.config)
}

</script>

<style>
@import 'sweetalert2/dist/sweetalert2.css';
@import '../../css/swal2.css';
</style>

<style scoped>

.main {
  display: flex;
  flex-direction: row;
  height: 100vh;
}

</style>

