<template>
  <div class="main">
    <Sidebar :chat="assistant.chat" v-if="!isStandaloneChat" />
    <ChatArea :chat="assistant.chat" :standalone="isStandaloneChat" />
    <Settings id="settings" />
    <DocRepos />
  </div>
</template>

<script setup lang="ts">

// components
import { ref, computed, onMounted, nextTick } from 'vue'
import { anyDict } from 'types'
import { store } from '../services/store'
import { saveFileContents } from '../services/download'
import Dialog from '../composables/dialog'
import useTipsManager from '../composables/tips_manager'
import Sidebar from '../components/Sidebar.vue'
import ChatArea from '../components/ChatArea.vue'
import DocRepos from './DocRepos.vue'
import Settings from './Settings.vue'
import Message from '../models/message'
import Attachment from '../models/attachment'
import Chat from '../models/chat'

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
  onEvent('retry-generation', onRetryGeneration)
  onEvent('stop-prompting', onStopGeneration)

  // main event
  window.api.on('delete-chat', () => {
    if (assistant.value.chat) {
      onDeleteChat(assistant.value.chat.uuid)
    }
  })

  // query params
  window.api.on('query-params', (params) => {
    processQueryParams(params)
  })
  if (props.extra) {
    processQueryParams(props.extra)
  }

  // intercept links
  document.addEventListener('click', (e) => {
    const target = (e.target || e.srcElement) as HTMLElement
    const href = target.getAttribute('href')
    if (href?.startsWith('#settings')) {
      emitEvent('open-settings', { initialTab: href.split('_')[1] })
      e.preventDefault()
      return false
    }
  })

  // show tips
  setTimeout(() => {
    tipsManager.showNextTip()
  }, 500)

  // check for updates
  window.api.on('update-available', onUpdateAvailable)
  setTimeout(() => {
    if (window.api.update.isAvailable()) {
      onUpdateAvailable()
    }
  }, 500)

})

const processQueryParams = (params: anyDict) => {

  // log
  console.log('Processing query params', JSON.stringify(params))
  
  // load extra from props
  if (params.promptId) {

    // load extra
    prompt.value = window.api.commands.getPrompt(params.promptId) || null
    engine.value = params.engine || null
    model.value = params.model || null

    // special commands are not executed
    const execute = !(params.execute === false || params.execute === 'false')

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

  // load chat
  if (params.chatId) {
    store.loadHistory()
    const chat: Chat = store.chats.find((c) => c.uuid === params.chatId)
    if (chat) {
      onSelectChat(chat)
    } else {
      console.log('Chat not found', params.chatId)
    }
  }

  // open settings
  if (params.settings) {
    emitEvent('open-settings')
  }
}

const onNewChat = () => {
  onSelectChat(null)
}

const onSelectChat = (chat: Chat) => {
  // create a new assistant to allow parallel querying
  // this will be garbage collected anyway
  assistant.value = new Assistant(store.config)
  assistant.value.setChat(chat)
  nextTick(() => {
    emitEvent('new-llm-chunk')
  })
}

const onRenameChat = async (chat: Chat) => {
  // prompt
  const { value: title } = await Dialog.show({
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

const onDeleteChat = async (chat: string) => {

  const chats: string[] = Array.isArray(chat) ? chat : [chat]
  const title = chats.length > 1
    ? 'Are you sure you want to delete these conversations?'
    : 'Are you sure you want to delete this conversation?'

  Dialog.show({
    target: document.querySelector('.main'),
    title: title,
    text: 'You can\'t undo this action.',
    confirmButtonText: 'Delete',
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {

      // fist remove
      for (const chat of chats) {
        let index = store.chats.findIndex((c) => c.uuid === chat)
        store.chats[index].delete()
        store.chats.splice(index, 1)
      }
      store.saveHistory()

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

const onSendPrompt = async ({ prompt, attachment, docrepo }: { prompt: string, attachment: Attachment, docrepo: any }) => {

  // make sure we can have an llm
  assistant.value.initLlm(store.config.llm.engine)
  if (!assistant.value.hasLlm()) {
    nextTick(() => emitEvent('open-settings', { initialTab: 'models' }))
    return
  }

  // save the attachment
  if (attachment?.saved === false) {
    attachment.loadContents()
    const fileUrl = saveFileContents(attachment.format(), attachment.b64Contents())
    if (fileUrl) {
      attachment.saved = true
      attachment.url = fileUrl
    }
  }

  // prompt
  assistant.value.prompt(prompt, {
    ...(engine.value && { engine: engine.value }),
    ...(model.value && { model: model.value }),
    attachment: attachment || null,
    docrepo: docrepo || null,
  }, (chunk) => {
    emitEvent('new-llm-chunk', chunk)
  })

}

const onRetryGeneration = async (message: Message) => {

  // find the message in the chat
  const index = assistant.value.chat.messages.findIndex((m) => m.uuid === message.uuid)
  if (index === -1) {
    return
  }

  // now remove all messages after this one
  assistant.value.chat.messages.splice(index)

  // now pop the last message
  const lastMessage = assistant.value.chat.messages.pop()

  // and retry
  onSendPrompt({
    prompt: lastMessage.content,
    attachment: lastMessage.attachment as Attachment,
    docrepo: assistant.value.chat.docrepo
  })

}

const onStopGeneration = async () => {
  await assistant.value.stop()
}

const onUpdateAvailable = () => {

  Dialog.show({
    title: 'Application Update Available',
    text: 'A new version has been downloaded. Restart the application to apply the update.',
    showCancelButton: true,
    confirmButtonText: 'Restart',
    cancelButtonText: 'Later',
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.update.apply()
    }
  })
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

