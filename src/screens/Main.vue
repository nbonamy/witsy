<template>
  <div class="main">
    <Sidebar :chat="assistant.chat" ref="sidebar" />
    <ChatArea :chat="assistant.chat" />
    <ChatEditor id="chat-editor" :chat="assistant.chat" :confirm-button-text="chatEditorConfirmButtonText" :on-confirm="chatEditorCallback" ref="chatEditor" />
    <Settings id="settings" />
    <DocRepos />
  </div>
</template>

<script setup lang="ts">

// components
import { Ref, ref, onMounted, nextTick, watch } from 'vue'
import { strDict, anyDict } from 'types'
import { store } from '../services/store'
import { saveFileContents } from '../services/download'
import { SendPromptParams } from '../components/Prompt.vue'
import Dialog from '../composables/dialog'
import useTipsManager from '../composables/tips_manager'
import Sidebar from '../components/Sidebar.vue'
import ChatArea from '../components/ChatArea.vue'
import ChatEditor, { ChatEditorCallback } from './ChatEditor.vue'
import DocRepos from './DocRepos.vue'
import Settings from './Settings.vue'
import Assistant from '../services/assistant'
import Message from '../models/message'
import Attachment from '../models/attachment'
import Chat from '../models/chat'
import LlmFactory from '../llms/llm'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

// init stuff
store.load()
const tipsManager = useTipsManager(store)
const llmFactory = new LlmFactory(store.config)
const assistant = ref(new Assistant(store.config))

const chatEditor: Ref<typeof ChatEditor> = ref(null)
const sidebar: Ref<typeof Sidebar> = ref(null)
const chatEditorConfirmButtonText = ref('Save')
const chatEditorCallback: Ref<ChatEditorCallback> = ref(() => {})

const props = defineProps({
  extra: Object
})

onMounted(() => {

  // init a new chat
  onNewChat()

  // events
  onEvent('new-chat', onNewChat)
  onEvent('new-chat-in-folder', onNewChatInFolder)
  onEvent('rename-chat', onRenameChat)
  onEvent('move-chat', onMoveChat)
  onEvent('delete-chat', onDeleteChat)
  onEvent('fork-chat', onForkChat)
  onEvent('rename-folder', onRenameFolder)
  onEvent('delete-folder', onDeleteFolder)
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
    } else if (href === '#retry_without_plugins') {
      if (assistant.value.chat) {
        assistant.value.chat.disableTools = true
        onRetryGeneration(assistant.value.chat.messages[assistant.value.chat.messages.length - 1])
      } else {
        console.log('No chat to retry')
      }
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

  // make sure engine and model are always up-to-date
  watch(() => store.config, updateChatEngineModel, { immediate: true, deep: true })

})

const processQueryParams = (params: anyDict) => {

  // log
  console.log('Processing query params', JSON.stringify(params))
  
  // load chat
  if (params.chatId) {
    store.loadHistory()
    const chat: Chat = store.history.chats.find((c) => c.uuid === params.chatId)
    if (chat) {
      onSelectChat(chat)
    } else {
      console.log('Chat not found', params.chatId)
    }
  }

  // open settings
  if (params.settings) {
    emitEvent('open-settings', null)
  }
}

const onNewChat = () => {
  assistant.value.initChat()
  updateChatEngineModel()
  nextTick(() => {
    emitEvent('new-llm-chunk', null)
  })
}

const onNewChatInFolder = (folderId: string) => {
  const folder = store.history.folders.find((f) => f.id === folderId)
  if (folder) {
    const chat = assistant.value.initChat()
    folder.chats.push(chat.uuid)
    store.history.chats.push(chat)
    onSelectChat(chat)
    store.saveHistory()
  }
}

const updateChatEngineModel = () => {
  if (!assistant.value.chat.hasMessages()) {
    const { engine, model } = llmFactory.getChatEngineModel()
    assistant.value.chat.setEngineModel(engine, model)
  }
}

const onSelectChat = (chat: Chat) => {
  // create a new assistant to allow parallel querying
  // this will be garbage collected anyway
  assistant.value = new Assistant(store.config)
  assistant.value.setChat(chat)
  nextTick(() => {
    emitEvent('new-llm-chunk', null)
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

const onMoveChat = async (chatId: string|string[]) => {

  const chatIds: string[] = Array.isArray(chatId) ? chatId : [chatId]
  const srcFolder = chatIds.length === 1
    ? store.history.folders.find((f) => f.chats.includes(chatIds[0]))
    : null

  const { value: folderId } = await Dialog.show({
    title: 'Select Destination Folder',
    input: 'select',
    inputValue: srcFolder?.id || store.rootFolder.id,
    inputOptions: [
      store.rootFolder,
      ...store.history.folders.sort((a, b) => a.name.localeCompare(b.name))
    ].reduce<strDict>((acc, f) => {
      acc[f.id] = f.name
      return acc
    }, {}),
    showCancelButton: true,
  });
  if (folderId) {

    // destination folder
    const dstFolder = store.history.folders.find((f) => f.id === folderId)

    for (const chatId of chatIds) {

      // remove from source folder
      const srcFolder = store.history.folders.find((f) => f.chats.includes(chatId))
      if (srcFolder) {
        srcFolder.chats = srcFolder.chats.filter((c) => c !== chatId)
      }

      // add to destination folder
      if (dstFolder) {
        dstFolder.chats.push(chatId)
      }

    }

    // done
    store.saveHistory()

  }

  // selection done
  sidebar.value?.cancelSelectMode()
}

const onDeleteChat = async (chatId: string|string[]) => {

  const chatIds: string[] = Array.isArray(chatId) ? chatId : [chatId]
  const title = chatIds.length > 1
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
      deleteChats(chatIds)
      store.saveHistory()

    }

    // selection done
    sidebar.value?.cancelSelectMode()
  })
}

const deleteChats = (chatIds: string[]) => {

  // fist remove from chat list
  for (const chatId of chatIds) {

    // remove from chats list
    let index = store.history.chats.findIndex((c) => c.uuid === chatId)
    if (index != -1) {
      store.history.chats[index].delete()
      store.history.chats.splice(index, 1)
    }

    // remove from folders
    for (const folder of store.history.folders) {
      folder.chats = folder.chats.filter((c) => c !== chatId)
    }
  }

  // if current chat
  if (chatIds.includes(assistant.value.chat?.uuid)) {
    emitEvent('new-chat', null)
  }

}

const onForkChat = (message: Message) => {

  // set up editor for forking
  chatEditorConfirmButtonText.value = 'Fork'
  chatEditorCallback.value = ({ title, engine, model }) => {
    const chat = assistant.value.chat
    forkChat(chat, message, title, engine, model)
  }

  // show editor
  chatEditor.value.show()
}

const forkChat = (chat: Chat, message: Message, title: string, engine: string, model: string) => {

  const fork = chat.fork(message)
  fork.title = title
  fork.engine = engine
  fork.model = model

  // special case: forking on a user message
  const messageIsFromUser = (message.role === 'user')
  if (messageIsFromUser) {
    fork.messages.pop()
  }
  
  // save
  store.history.chats.push(fork)
  const folder = store.history.folders.find((f) => f.chats.includes(chat.uuid))
  if (folder) {
    folder.chats.push(fork.uuid)
  }

  // select
  onSelectChat(fork)

  // now send prompt
  if (messageIsFromUser) {
    //emitEvent('set-prompt', message)
    onSendPrompt({
      prompt: message.content,
      attachment: message.attachment as Attachment,
      docrepo: fork.docrepo,
      expert: message.expert
    })
  }
}

const onRenameFolder = async (folderId: string) => {
  const folder = store.history.folders.find((f) => f.id === folderId)
  if (folder) {
    const { value: name } = await Dialog.show({
      title: 'Rename Folder',
      input: 'text',
      inputValue: folder.name,
      showCancelButton: true,
    });
    if (name) {
      folder.name = name
      store.saveHistory()
    }
  }
}

const onDeleteFolder = async (folderId: string) => {
  Dialog.show({
    title: 'Are you sure you want to delete this folder?',
    text: 'You can\'t undo this action.',
    customClass: { denyButton: 'alert-neutral' },
    confirmButtonText: 'OK but keep conversations',
    denyButtonText: 'OK and delete conversations',
    showCancelButton: true,
    showDenyButton: true,
  }).then((result) => {

    // find folder and delete it
    const folder = store.history.folders.find((f) => f.id === folderId)
    store.history.folders = store.history.folders.filter((f) => f.id !== folderId)

    // delete chats if asked
    if (result.isDenied) {
      deleteChats(folder.chats)
    }

    // done
    store.saveHistory()
  })
}

const onSendPrompt = async (params: SendPromptParams) => {

  // deconstruct params
  const { prompt, attachment, docrepo, expert } = params

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

  // make sure the chat is part of history
  if (!store.history.chats.find((c) => c.uuid === assistant.value.chat.uuid)) {
    assistant.value.chat.initTitle()
    store.history.chats.push(assistant.value.chat)
    store.saveHistory()
  }

  // prompt
  await assistant.value.prompt(prompt, {
    model: assistant.value.chat.model,
    attachment: attachment || null,
    docrepo: docrepo || null,
    expert: expert || null,
  }, (chunk) => {
    emitEvent('new-llm-chunk', chunk)
  }, () => {
    store.saveHistory()
  })

  // save
  store.saveHistory()

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
    docrepo: assistant.value.chat.docrepo,
    expert: lastMessage.expert
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

