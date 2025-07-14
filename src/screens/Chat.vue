<template>
  <div class="chat panel-content">
    <ChatSidebar :chat="assistant.chat" ref="sidebar" />
    <ChatArea :chat="assistant.chat" :is-left-most="!sidebar?.isVisible()" ref="chatArea" />
    <ChatEditor :chat="assistant.chat" :dialog-title="chatEditorTitle" :confirm-button-text="chatEditorConfirmButtonText" :on-confirm="chatEditorCallback" ref="chatEditor" />
  </div>
</template>

<script setup lang="ts">

import { LlmChunkContent } from 'multi-llm-ts'
import { strDict } from '../types'
import { MenuBarMode } from '../components/MenuBar.vue'
import { ref, onMounted, nextTick, watch } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { saveFileContents } from '../services/download'
import { SendPromptParams } from '../components/Prompt.vue'
import Dialog from '../composables/dialog'
import useTipsManager from '../composables/tips_manager'
import ChatSidebar from '../components/ChatSidebar.vue'
import ChatArea from '../components/ChatArea.vue'
import ChatEditor, { ChatEditorCallback } from './ChatEditor.vue'
import Assistant, { GenerationEvent } from '../services/assistant'
import Message from '../models/message'
import Chat from '../models/chat'
import LlmFactory from '../llms/llm'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

// init stuff
const tipsManager = useTipsManager(store)
const llmManager = LlmFactory.manager(store.config)
const assistant = ref(new Assistant(store.config))

const chatArea= ref<typeof ChatArea>(null)
const chatEditor= ref<typeof ChatEditor>(null)
const sidebar= ref<typeof ChatSidebar>(null)
const chatEditorTitle = ref('')
const chatEditorConfirmButtonText = ref('common.save')
const chatEditorCallback= ref<ChatEditorCallback>(() => {})

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
  onEvent('delete-message', onDeleteMessage)
  onEvent('rename-folder', onRenameFolder)
  onEvent('delete-folder', onDeleteFolder)
  onEvent('select-chat', onSelectChat)
  onEvent('send-prompt', onSendPrompt)
  onEvent('retry-generation', onRetryGeneration)
  onEvent('stop-prompting', onStopGeneration)
  onEvent('toggle-sidebar', onToggleSidebar)
  onEvent('main-view-changed', onMainViewChanged)

  // main events
  window.api.on('delete-chat', () => {
    if (assistant.value.chat) {
      onDeleteChat(assistant.value.chat.uuid)
    }
  })
  window.api.on('computer-stop', onStopGeneration)

  // intercept links
  document.addEventListener('click', (e) => {
    const target = (e.target || e.srcElement) as HTMLElement
    const href = target.getAttribute('href')
    if (href?.startsWith('#settings')) {
      const parts = href.split('_')
      window.api.settings.open({ initialTab: parts[1], engine: parts.length > 2 ? parts[2] : '' })
      e.preventDefault()
      return false
    } else if (href === '#retry_without_plugins') {
      if (assistant.value.chat) {
        assistant.value.chat.disableTools()
        onRetryGeneration(assistant.value.chat.messages[assistant.value.chat.messages.length - 1])
      } else {
        console.log('No chat to retry')
      }
      e.preventDefault()
      return false
    } else if (href === '#retry_without_params') {
      if (assistant.value.chat) {
        assistant.value.chat.modelOpts = undefined
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
    if (typeof window !== 'undefined' && window.api.update.isAvailable()) {
      onUpdateAvailable()
    }
  }, 500)

  // make sure engine and model are always up-to-date
  watch(() => store.config.llm.engine, updateChatEngineModel, { immediate: true, deep: true })
  watch(() => store.config.engines, updateChatEngineModel, { immediate: true, deep: true })
  watch(() => store.config.llm.defaults, updateChatEngineModel, { immediate: true, deep: true })

  // watch props for changes
  watch(() => props.extra, (params) => {
    if (params?.chatId) {
      console.log('[chat] props changed', params)
      store.loadHistory()
      const chat: Chat = store.history.chats.find((c) => c.uuid === params.chatId)
      if (chat) {
        onSelectChat(chat)
      } else {
        console.log('Chat not found', params.chatId)
      }
    }
  }, { immediate: true })

})

const onNewChat = async (payload?: any) => {
  const { prompt, attachments, submit } = payload || {}
  assistant.value.initChat()
  updateChatEngineModel()
  if (prompt) chatArea.value?.setPrompt(prompt)
  if (attachments) chatArea.value?.attach(attachments)
  chatArea.value?.setExpert(null)
  chatArea.value?.setDeepResearch(false)
  await nextTick()
  emitEvent('new-llm-chunk', null)
  if (submit) {
    chatArea.value?.sendPrompt()
  }
}

const onNewChatInFolder = (folderId: string) => {
  
  // get
  const folder = store.history.folders.find((f) => f.id === folderId)
  const chat = assistant.value.initChat()
  
  // engine and model 
  if (folder.defaults) {
    llmManager.setChatModel(folder.defaults.engine, folder.defaults.model)
  }

  // set it
  updateChatEngineModel()

  // other config
  if (folder.defaults) {
    chat.disableStreaming = folder.defaults.disableStreaming
    chat.tools = folder.defaults.tools
    chat.instructions = folder.defaults.instructions
    chat.locale = folder.defaults.locale
    chat.docrepo = folder.defaults.docrepo
    chat.modelOpts = folder.defaults.modelOpts
  }

  // init
  chat.initTitle()
  store.addChat(chat, folderId)
  onSelectChat(chat)

  // expert
  if (folder.defaults?.expert) {
    const expert = store.experts.find((e) => e.id === folder.defaults.expert)
    if (expert) {
      chatArea.value?.setExpert(expert)
    }
  }

}

const updateChatEngineModel = () => {
  if (!assistant.value.chat.hasMessages()) {
    const { engine, model } = llmManager.getChatEngineModel()
    assistant.value.chat.setEngineModel(engine, model)
    store.initChatWithDefaults(assistant.value.chat)
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
    title: t('main.chat.rename'),
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
    title: t('main.chat.moveToFolder'),
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
    ? t('main.chat.confirmDeleteMultiple')
    : t('main.chat.confirmDeleteSingle')

  const result = await Dialog.show({
    target: document.querySelector('.main'),
    title: title,
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  })
    
  if (result.isConfirmed) {

    // fist remove
    deleteChats(chatIds)
    store.saveHistory()

  }

  // selection done
  sidebar.value?.cancelSelectMode()

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
  chatEditorTitle.value = 'chat.fork.title'
  chatEditorConfirmButtonText.value = 'common.fork'
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
  const folder = store.history.folders.find((f) => f.chats.includes(chat.uuid))
  store.addChat(fork, folder?.id)

  // select
  onSelectChat(fork)

  // now send prompt
  if (messageIsFromUser) {
    //emitEvent('set-prompt', message)
    onSendPrompt({
      instructions: chat.instructions,
      prompt: message.content,
      attachments: message.attachments,
      docrepo: fork.docrepo,
      expert: message.expert,
      deepResearch: message.deepResearch || false,
    })
  }
}

const onDeleteMessage = async (message: Message) => {
  const result = await Dialog.show({
    target: document.querySelector('.main'),
    title: t('main.message.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  })
  if (result.isConfirmed) {
    assistant.value.chat.deleteMessagesStarting(message)
    store.saveHistory()
    if (assistant.value.chat.messages.length === 1) {
      assistant.value.chat.delete()
      store.history.chats = store.history.chats.filter((c) => c.uuid !== assistant.value.chat.uuid)
      onNewChat()
    }
  }
}

const onRenameFolder = async (folderId: string) => {
  const folder = store.history.folders.find((f) => f.id === folderId)
  if (folder) {
    const { value: name } = await Dialog.show({
      title: t('main.folder.rename'),
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
  
  const result = await Dialog.show({
    title: t('main.folder.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    customClass: { denyButton: 'alert-neutral' },
    confirmButtonText: t('main.folder.keepConversations'),
    denyButtonText: t('main.folder.deleteConversations'),
    showCancelButton: true,
    showDenyButton: true,
  })

  if (result.isDismissed) {
    return
  }

  // find folder and delete it
  const folder = store.history.folders.find((f) => f.id === folderId)
  store.history.folders = store.history.folders.filter((f) => f.id !== folderId)

  // delete chats if asked
  if (result.isDenied) {
    deleteChats(folder.chats)
  }

  // done
  store.saveHistory()

}

const onSendPrompt = async (params: SendPromptParams) => {

  // deconstruct params
  const { instructions, prompt, attachments, docrepo, expert, deepResearch } = params

  // make sure we can have an llm
  assistant.value.initLlm(store.config.llm.engine)
  if (!assistant.value.hasLlm()) {
    nextTick(() => window.api.settings.open({ initialTab: 'models' }))
    return
  }

  // save the attachment
  for (const attachment of attachments ?? []) {
    if (attachment?.saved === false) {
      attachment.loadContents()
      const fileUrl = saveFileContents(attachment.format(), attachment.b64Contents())
      if (fileUrl) {
        attachment.saved = true
        attachment.url = fileUrl
      }
    }
  }

  // we will need that (function because chat may be updated later)
  const isUsingComputer = () => {
    return llmManager.isComputerUseModel(assistant.value.chat.engine, assistant.value.chat.model)
  }

  // prompt
  const rc = await assistant.value.prompt(prompt, {
    model: assistant.value.chat.model,
    instructions: instructions || assistant.value.chat.instructions,
    attachments: attachments || [],
    docrepo: docrepo || null,
    expert: expert || null,
    deepResearch: deepResearch || false,
  }, (chunk) => {
  
    // if we get a chunk, emit it
    emitEvent('new-llm-chunk', chunk)

    // computer use
    if (isUsingComputer()) {
      window.api.computer.updateStatus(chunk)
    }
  
  
  }, async (event: GenerationEvent) => {

    if (event === 'before_generation') {

      // not very nice but gets the message list scrolling
      emitEvent('new-llm-chunk', {
        type: 'content',
        text: '',
        done: false,
      } as LlmChunkContent)

      // for computer use
      if (isUsingComputer()) {
        window.api.computer.start()
      }

      // make sure the chat is part of history
      if (!assistant.value.chat.temporary && !store.history.chats.find((c) => c.uuid === assistant.value.chat.uuid)) {
        assistant.value.chat.initTitle()
        store.addChat(assistant.value.chat)
      }

    } else if (event === 'plugins_disabled') {
      tipsManager.showTip('pluginsDisabled')
    } else if (event === 'before_title') {
      store.saveHistory()
    }
  })

  // for computer use
  if (isUsingComputer()) {
    window.api.computer.close()
  }

  // done with deep research
  if (rc === 'success') {
    chatArea.value?.setDeepResearch(false)
  }

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
    instructions: assistant.value.chat.instructions,
    prompt: lastMessage.content,
    attachments: lastMessage.attachments,
    docrepo: assistant.value.chat.docrepo,
    expert: lastMessage.expert,
    deepResearch: lastMessage.deepResearch || false,
  })

}

const onStopGeneration = async () => {
  await assistant.value.stop()
}

const onUpdateAvailable = () => {

  Dialog.show({
    title: t('main.update.available'),
    text: t('main.update.restart'),
    showCancelButton: true,
    confirmButtonText: t('main.update.restartNow'),
    cancelButtonText: t('main.update.later'),
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.update.apply()
    }
  })
}

const onToggleSidebar = () => {
  if (sidebar.value?.isVisible()) {
    sidebar.value.hide()
  } else {
    sidebar.value.show()
  }
}

const onMainViewChanged = (mode: MenuBarMode) => {
  
  if (mode !== 'computer-use') {
    return
  }

  assistant.value.initChat()
  assistant.value.chat.engine = 'anthropic'
  assistant.value.chat.model = 'computer-use'

  const instructions = new Message('system', assistant.value.getSystemInstructions())
  assistant.value.chat.addMessage(instructions)

  const message = new Message('assistant', t('computerUse.instructions'))
  message.uiOnly = true
  assistant.value.chat.addMessage(message)

  nextTick(() => {
    emitEvent('new-llm-chunk', null)
  })

}

defineExpose({
  startDictation: () => chatArea.value?.startDictation(),
})

</script>

<style>
@import '../../css/panel-content.css';
@import 'sweetalert2/dist/sweetalert2.css';
@import '../../css/swal2.css';
</style>

<style scoped>

</style>
