<template>
  <div class="chat split-pane">
    <ChatSidebar :chat="assistant.chat" @new-chat="onNewChat" @run-agent="onRunAgent" ref="sidebar" />
    <ChatArea :chat="assistant.chat" :is-left-most="!isSidebarVisible" ref="chatArea" @prompt="onSendPrompt" @run-agent="onRunAgent" @stop-generation="onStopGeneration" />
    <ChatEditor :chat="assistant.chat" :dialog-title="chatEditorTitle" :confirm-button-text="chatEditorConfirmButtonText" :on-confirm="chatEditorCallback" ref="chatEditor" />
    <CreateAgentRun :title="agent?.name ?? ''" ref="builder" />
    <AgentPicker ref="picker" />
  </div>
</template>

<script setup lang="ts">

import { LlmChunkContent } from 'multi-llm-ts'
import { A2APromptOpts, Agent } from 'types/agents'
import { strDict } from 'types/index'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import Chat from '@models/chat'
import Message from '@models/message'
import ChatArea from '@components/ChatArea.vue'
import ChatSidebar from '@components/ChatSidebar.vue'
import CreateAgentRun from '@components/CreateAgentRun.vue'
import { MenuBarMode } from '@components/MenuBar.vue'
import { SendPromptParams } from '@components/Prompt.vue'
import Dialog from '@renderer/utils/dialog'
import useEventBus from '@composables/event_bus'
import useTipsManager from '@renderer/utils/tips_manager'
import { createAgentExecutor, isAgentConversation } from '@services/agent_utils'
import Assistant from '@services/assistant'
import { saveFileContents } from '@services/download'
import { GenerationEvent } from '@services/generator'
import { t } from '@services/i18n'
import LlmUtils from '@services/llm_utils'
import LlmFactory from '@services/llms/llm'
import { store } from '@services/store'
import AgentPicker from './AgentPicker.vue'
import ChatEditor, { ChatEditorCallback } from './ChatEditor.vue'

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
const builder = ref<typeof CreateAgentRun>(null)
const picker = ref<typeof AgentPicker>(null)
const agent = ref<Agent|null>(null)

let abortController: AbortController | null = null

const isSidebarVisible = computed(() => sidebar.value?.isVisible() ?? true)

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
  onEvent('retry-generation', onRetryGeneration)
  onEvent('resend-after-edit', onResendAfterEdit)
  onEvent('toggle-sidebar', onToggleSidebar)
  onEvent('main-view-changed', onMainViewChanged)

  // main events
  window.api.on('new-chat', onNewChat)
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
    if (params?.text) {
      console.log('[chat] setting prompt text', params.text)
      nextTick(() => {
        chatArea.value?.setPrompt(params.text)
        chatArea.value?.focusPrompt()
      })
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

const importChat = (chatData: any) => {
  // Parse the chat from JSON
  const chat = Chat.fromJson(chatData)

  // Add to history (no folder)
  store.addChat(chat)

  // Load the chat
  assistant.value.setChat(chat)
  updateChatEngineModel()

  // Emit event
  emitEvent('new-llm-chunk', null)
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
    // @ts-expect-error backwards compatibility: migrate docrepo to docrepos
    chat.docrepos = folder.defaults.docrepos?.length ? folder.defaults.docrepos : (folder.defaults.docrepo ? [folder.defaults.docrepo] : undefined)
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
  const { value: title } = await Dialog.show({
    title: t('main.chat.rename'),
    input: 'text',
    inputValue: chat.title,
    confirmButtonText: t('common.rename'),
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
    confirmButtonText: t('common.move'),
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
      docrepos: fork.docrepos,
      expert: message.expert,
      execMode: message.execMode || 'prompt',
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
      confirmButtonText: t('common.rename'),
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
    confirmButtonText: t('main.folder.keepConversations'),
    denyButtonText: t('main.folder.deleteConversations'),
    showCancelButton: true,
    showDenyButton: true,
    customClass: { 'actions': 'actions-stacked' }
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
  const { instructions, prompt, attachments, docrepos, expert, execMode } = params

  // if the chat is still in an agentic context then run the agent
  const agent = isAgentConversation(assistant.value.chat)
  if (agent) {
    // For A2A continuation, pass the prompt in a dict
    // The A2A executor will use agent.steps[0].prompt as template, or use the prompt value directly if no template
    runAgent(agent, { prompt }, assistant.value.chat.lastMessage()?.a2aContext)
    return
  }

  // make sure we can have an llm
  assistant.value.initLlm(store.config.llm.engine)
  if (!assistant.value.hasLlm()) {
    const rc = await Dialog.show({
      title: t('prompt.noEngineAvailable.title'),
      text: t('prompt.noEngineAvailable.text'),
      showCancelButton: true,
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.no'),
    })
    if (rc.isConfirmed) {
      window.api.settings.open({ initialTab: 'models' })
    }
    return
  }

  // save the attachment
  for (const attachment of attachments ?? []) {
    if (attachment?.saved === false) {
      await attachment.loadContents()
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

  // create abort controller for this prompt
  abortController = new AbortController()

  // prompt
  const rc = await assistant.value.prompt(prompt, {
    model: assistant.value.chat.model,
    instructions: instructions || assistant.value.chat.instructions,
    attachments: attachments || [],
    docrepos: docrepos || null,
    expert: expert || null,
    execMode: execMode || 'prompt',
    abortSignal: abortController.signal,
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

const onRunAgent = async (agentId?: string) => {

  // select agent
  if (agentId) {
    agent.value = store.agents.find((a) => a.uuid === agentId)
  } else {
    agent.value = await picker.value.pick()
  }


  // required
  if (!agent.value) {
    return
  }

  builder.value.show(agent.value, {}, async (values: Record<string, string>) => {

    // we need a new chat
    assistant.value.initChat()
    updateChatEngineModel()

    // and run it
    runAgent(agent.value, values)

  })

}

const runAgent = async (agent: Agent, values: Record<string, string>, a2aContext?: A2APromptOpts) => {

  // create abort controller for this agent run
  abortController = new AbortController()

  // create executor for this agent
  const executor = createAgentExecutor(store.config, store.workspace.uuid, agent)

  await executor.run('manual', values, {
    streaming: true,
    ephemeral: false,
    model: assistant.value.chat.model,
    chat: assistant.value.chat,
    a2aContext: a2aContext,
    abortSignal: abortController.signal,
  }, async (event: GenerationEvent) => {

    if (event === 'before_generation') {

      // not very nice but gets the message list scrolling
      emitEvent('new-llm-chunk', {
        type: 'content',
        text: '',
        done: false,
      } as LlmChunkContent)

      // make sure the chat is part of history
      if (!assistant.value.chat.temporary && !store.history.chats.find((c) => c.uuid === assistant.value.chat.uuid)) {
        assistant.value.chat.initTitle()
        store.addChat(assistant.value.chat)
      }

    } else if (event === 'before_title') {
      store.saveHistory()
    }

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

  // Get the last message before mutating (to avoid triggering Vue reactivity)
  const lastMessage = assistant.value.chat.messages[index-1]

  // now remove all messages after this one (including the one we're retrying)
  assistant.value.chat.messages.splice(index-1)

  // depends if this is an agent response or not
  if (message.agentId) {

    // make sure the agent still exists
    const agent = store.agents.find((a) => a.uuid === message.agentId)
    if (!agent) {
      await Dialog.waitUntilClosed()
      Dialog.alert(t('chat.agent.notFound'))
      return
    }

    // now we can run it - for retry, pass the message content as the prompt value
    // We use a generic 'prompt' key since we don't know the original variable names
    runAgent(agent, { prompt: lastMessage.content })

  } else {

    onSendPrompt({
      instructions: assistant.value.chat.instructions,
      prompt: lastMessage.content,
      attachments: lastMessage.attachments,
      docrepos: assistant.value.chat.docrepos,
      expert: lastMessage.expert,
      execMode: lastMessage.execMode,
    })

  }

}

const onResendAfterEdit = async (payload: { message: Message, newContent: string }) => {

  // find the message in the chat
  const index = assistant.value.chat.messages.findIndex((m) => m.uuid === payload.message.uuid)
  if (index === -1) {
    return
  }

  // Remove this message and all messages after it
  assistant.value.chat.messages.splice(index)

  // Resend with the updated content
  if (payload.message.agentId) {

    // make sure the agent still exists
    const agent = store.agents.find((a) => a.uuid === payload.message.agentId)
    if (!agent) {
      await Dialog.waitUntilClosed()
      Dialog.alert(t('chat.agent.notFound'))
      return
    }

    // Run the agent with the new content
    runAgent(agent, { prompt: payload.newContent })

  } else {

    onSendPrompt({
      instructions: assistant.value.chat.instructions,
      prompt: payload.newContent,
      attachments: payload.message.attachments,
      docrepos: assistant.value.chat.docrepos,
      expert: payload.message.expert,
      execMode: payload.message.execMode,
    })

  }

}

const onStopGeneration = async () => {
  abortController?.abort()
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

  const llmUtils = new LlmUtils(store.config)
  const instructions = new Message('system', llmUtils.getSystemInstructions())
  assistant.value.chat.addMessage(instructions)

  const message = new Message('assistant', t('computerUse.instructions'))
  message.uiOnly = true
  assistant.value.chat.addMessage(message)

  nextTick(() => {
    emitEvent('new-llm-chunk', null)
  })

}

defineExpose({
  newChat: onNewChat,
  importChat,
  startDictation: () => chatArea.value?.startDictation(),
})

</script>

<style scoped>

/* Chat list adds one pixel
   To the main window's height somehow
   We don't know why though */
.chat.split-pane {
  height: calc(100vh - var(--window-toolbar-height) - 2.5rem - 1px) !important;
}

</style>
