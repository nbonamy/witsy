<template>
  <div class="chat split-pane">
    <ChatSidebar :chat="assistant.chat" :generating-chat-ids="generatingChatIds" ref="sidebar" />
    <ChatArea :chat="assistant.chat" :is-left-most="!isSidebarVisible" ref="chatArea" @prompt="onSendPrompt" @stop-generation="onStopGeneration" @toggle-sidebar="onToggleSidebar" />
    <ChatEditor :chat="assistant.chat" :dialog-title="chatEditorTitle" :confirm-button-text="chatEditorConfirmButtonText" :on-confirm="chatEditorCallback" ref="chatEditor" />
    <CreateAgentRun :title="agent?.name ?? ''" ref="builder" />
    <AgentPicker ref="picker" />
  </div>
</template>

<script setup lang="ts">

import ChatArea from '@components/ChatArea.vue'
import ChatSidebar from '@components/ChatSidebar.vue'
import CreateAgentRun from '@components/CreateAgentRun.vue'
import { SendPromptParams } from '@components/Prompt.vue'
import useEventBus from '@composables/event_bus'
import useEventListener from '@composables/event_listener'
import useIpcListener from '@composables/ipc_listener'
import Chat from '@models/chat'
import Message from '@models/message'
import Dialog from '@renderer/utils/dialog'
import useTipsManager from '@renderer/utils/tips_manager'
import { createAgentExecutor, isAgentConversation } from '@services/agent_utils'
import Assistant from '@services/assistant'
import { saveFileContents } from '@services/download'
import { GenerationEvent } from '@services/generator'
import { t } from '@services/i18n'
import LlmUtils from '@services/llm_utils'
import LlmFactory from '@services/llms/llm'
import { store } from '@services/store'
import { LlmChunk, LlmChunkContent } from 'multi-llm-ts'
import { A2APromptOpts, Agent } from 'types/agents'
import { strDict } from 'types/index'
import { computed, nextTick, onMounted, PropType, provide, Ref, ref, watch } from 'vue'
import AgentPicker from './AgentPicker.vue'
import ChatEditor, { ChatEditorCallback } from './ChatEditor.vue'

export type ChatSessionStatus = 'idle' | 'generating'

export type SearchState = {
  filter: Ref<string|null>
  navigate: Ref<number>
  localSearch: Ref<boolean>
}

export interface ChatSession {
  assistant: Assistant
  abortController: AbortController | null
  status: ChatSessionStatus
}

const { onBusEvent } = useEventBus()
const { onDomEvent } = useEventListener()
const { onIpcEvent } = useIpcListener()

// init stuff
const tipsManager = useTipsManager(store)
const llmManager = LlmFactory.manager(store.config)

// provide chunk for MessageList (scoped to this component tree)
const latestChunk = ref<LlmChunk | null>(null)
provide('latestChunk', latestChunk)

// provide generating state for Prompt component
const isGenerating = computed(() => activeSession.value?.status === 'generating')
provide('isGenerating', isGenerating)

// provide search state for sidebar, message list and message body
const searchState: SearchState = { filter: ref<string | null>(null), navigate: ref(0), localSearch: ref(false) }
provide('searchState', searchState)

// provide callbacks for descendant components (scoped to this component tree)
// handlers are defined later but called via these wrappers
const chatCallbacks = {
  onDeleteChat: (chatId: string | string[]) => onDeleteChat(chatId),
  onDeleteFolder: (folderId: string) => onDeleteFolder(folderId),
  onDeleteMessage: (message: Message) => onDeleteMessage(message),
  onForkChat: (message: Message) => onForkChat(message),
  onMoveChat: (chatId: string | string[]) => onMoveChat(chatId),
  onNewChat: () => onNewChat(null),
  onNewChatInFolder: (folderId: string) => onNewChatInFolder(folderId),
  onRenameChat: (chat: Chat) => onRenameChat(chat),
  onRenameFolder: (folderId: string) => onRenameFolder(folderId),
  onResendAfterEdit: (payload: { message: Message, newContent: string }) => onResendAfterEdit(payload),
  onRetryGeneration: (message: Message) => onRetryGeneration(message),
  onRunAgent: (agentId?: string) => onRunAgent(agentId),
  onSelectChat: (chat: Chat) => onSelectChat(chat),
  onSetPrompt: (message: Message) => chatArea.value?.setPrompt(message),
}
provide('chat-callbacks', chatCallbacks)

export type ChatCallbacks = typeof chatCallbacks

export type ChatMode = 'chat' | 'computer-use'

const props = defineProps({
  mode: {
    type: String as PropType<ChatMode>,
    default: 'chat',
  },
  active: {
    type: Boolean,
    default: true,
  },
  extra: {
    type: Object as PropType<strDict>,
    default: () => ({}),
  },
})

// provide active state so any descendant can check visibility
const chatActive = computed(() => props.active)
provide('chatActive', chatActive)

// session management for parallel chats
const sessions = ref<Record<string, ChatSession>>({})
const activeSessionId = ref<string | null>(null)

// computed active session and assistant for template binding
const activeSession = computed<ChatSession | null>(() => {
  if (!activeSessionId.value) return null
  return sessions.value[activeSessionId.value] ?? null
})
const assistant = computed(() => activeSession.value?.assistant ?? new Assistant(store.config))

// expose generating chat IDs for sidebar indicator
const generatingChatIds = computed(() => {
  const ids: string[] = []
  for (const chatId in sessions.value) {
    if (sessions.value[chatId].status === 'generating') {
      ids.push(chatId)
    }
  }
  // if only the active session is generating, no need for spinner (user sees streaming)
  if (ids.length === 1 && ids[0] === activeSessionId.value) {
    return []
  }
  return ids
})

const chatArea= ref<typeof ChatArea>(null)
const chatEditor= ref<typeof ChatEditor>(null)
const sidebar= ref<typeof ChatSidebar>(null)
const chatEditorTitle = ref('')
const chatEditorConfirmButtonText = ref('common.save')
const chatEditorCallback= ref<ChatEditorCallback>(() => {})
const builder = ref<typeof CreateAgentRun>(null)
const picker = ref<typeof AgentPicker>(null)
const agent = ref<Agent|null>(null)

const isSidebarVisible = computed(() => sidebar.value?.isVisible() ?? true)

// session management helpers
const createSession = (chat: Chat): ChatSession => {
  const newAssistant = new Assistant(store.config)
  newAssistant.setChat(chat)
  return {
    assistant: newAssistant,
    abortController: null,
    status: 'idle',
  }
}

const setActiveSession = (chatId: string, chat: Chat): ChatSession => {
  // cleanup old idle session if switching away
  if (activeSessionId.value && activeSessionId.value !== chatId) {
    const oldSession = sessions.value[activeSessionId.value]
    if (oldSession?.status === 'idle') {
      delete sessions.value[activeSessionId.value]
    }
  }

  // get or create session
  let session = sessions.value[chatId]
  if (!session) {
    session = createSession(chat)
    sessions.value[chatId] = session
  }

  // set active
  activeSessionId.value = chatId
  return session
}

const cleanupSession = (chatId: string) => {
  const session = sessions.value[chatId]
  if (session) {
    session.abortController?.abort()
    delete sessions.value[chatId]
  }
}

const setSessionStatus = (chatId: string, status: ChatSessionStatus) => {
  const session = sessions.value[chatId]
  if (session) {
    session.status = status
  }
}

const onDeleteChatIpc = () => {
  if (assistant.value.chat) {
    onDeleteChat(assistant.value.chat.uuid)
  }
}

const onLinkClick = (e: Event) => {
  const target = (e.target || (e as any).srcElement) as HTMLElement
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
}


onMounted(() => {

  // init a new chat
  onNewChat()

  // events (only global ones - others use chat-callbacks via provide/inject)
  onBusEvent('new-chat', onNewChat)

  // watch mode prop for computer-use initialization
  watch(() => props.mode, (mode) => {
    if (mode === 'computer-use') {
      onComputerUseMode()
    }
  })

  // IPC events
  onIpcEvent('new-chat', onNewChat)
  onIpcEvent('search-chat', searchChat)
  onIpcEvent('delete-chat', onDeleteChatIpc)
  onIpcEvent('computer-stop', onStopGeneration)
  onIpcEvent('update-available', onUpdateAvailable)

  // intercept links
  onDomEvent(document, 'click', onLinkClick)

  // show tips
  setTimeout(() => {
    tipsManager.showNextTip()
  }, 500)

  // check for updates
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

  // create a new chat and session
  const newChat = new Chat()
  const session = setActiveSession(newChat.uuid, newChat)

  updateChatEngineModel()
  if (prompt) chatArea.value?.setPrompt(prompt)
  if (attachments) chatArea.value?.attach(attachments)
  chatArea.value?.setExpert(null)
  chatArea.value?.setDeepResearch(false)
  await nextTick()
  latestChunk.value = null
  if (submit) {
    chatArea.value?.sendPrompt()
  }
}

const searchChat = () => {
  if (!props.active) return
  sidebar.value?.clearFilter()
  if (assistant.value?.chat?.hasMessages()) {
    searchState.localSearch.value = true
  }
}

const importChat = (chatData: any) => {
  // Parse the chat from JSON
  const chat = Chat.fromJson(chatData)

  // Add to history (no folder)
  store.addChat(chat)

  // Load the chat via session
  setActiveSession(chat.uuid, chat)
  updateChatEngineModel()

  // Emit event
  latestChunk.value = null
}

const onNewChatInFolder = (folderId: string) => {

  // get folder and create new chat
  const folder = store.history.folders.find((f) => f.id === folderId)
  const chat = new Chat()

  // create session for this chat
  setActiveSession(chat.uuid, chat)

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
  // switch to session for this chat (creates if needed, cleans up old idle session)
  setActiveSession(chat.uuid, chat)
  nextTick(() => {
    latestChunk.value = null
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

    // cleanup session (aborts if generating)
    cleanupSession(chatId)

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

  // if current chat was deleted, create new chat
  if (chatIds.includes(activeSessionId.value)) {
    onNewChat(null)
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
    //emitBusEvent('set-prompt', message)
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

  // capture the current session for this generation (allows parallel chats)
  const session = activeSession.value
  if (!session) return
  const sessionChatId = session.assistant.chat.uuid

  // if the chat is still in an agentic context then run the agent
  const agent = isAgentConversation(session.assistant.chat)
  if (agent) {
    // For A2A continuation, pass the prompt in a dict
    // The A2A executor will use agent.steps[0].prompt as template, or use the prompt value directly if no template
    runAgent(agent, { prompt }, session.assistant.chat.lastMessage()?.a2aContext)
    return
  }

  // make sure we can have an llm
  session.assistant.initLlm(store.config.llm.engine)
  if (!session.assistant.hasLlm()) {
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
    return llmManager.isComputerUseModel(session.assistant.chat.engine, session.assistant.chat.model)
  }

  // create abort controller for this session
  session.abortController = new AbortController()
  setSessionStatus(sessionChatId, 'generating')

  // prompt
  const rc = await session.assistant.prompt(prompt, {
    model: session.assistant.chat.model,
    instructions: instructions || session.assistant.chat.instructions,
    attachments: attachments || [],
    docrepos: docrepos || null,
    expert: expert || null,
    execMode: execMode || 'prompt',
    abortSignal: session.abortController.signal,
  }, (chunk) => {

    // only emit chunk events for the active session
    if (sessionChatId === activeSessionId.value) {
      latestChunk.value = chunk
    }

    // computer use
    if (isUsingComputer()) {
      window.api.computer.updateStatus(chunk)
    }

  }, async (event: GenerationEvent) => {

    if (event === 'before_generation') {

      // not very nice but gets the message list scrolling (only for active session)
      if (sessionChatId === activeSessionId.value) {
        latestChunk.value = {
          type: 'content',
          text: '',
          done: false,
        } as LlmChunkContent
      }

      // for computer use
      if (isUsingComputer()) {
        window.api.computer.start()
      }

      // make sure the chat is part of history
      if (!session.assistant.chat.temporary && !store.history.chats.find((c) => c.uuid === session.assistant.chat.uuid)) {
        session.assistant.chat.initTitle()
        store.addChat(session.assistant.chat)
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

  // done with deep research (only for active session)
  if (rc === 'success' && sessionChatId === activeSessionId.value) {
    chatArea.value?.setDeepResearch(false)
  }

  // generation complete - update status and cleanup if not active
  setSessionStatus(sessionChatId, 'idle')
  if (sessionChatId !== activeSessionId.value) {
    delete sessions.value[sessionChatId]
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

    // we need a new chat and session
    const newChat = new Chat()
    setActiveSession(newChat.uuid, newChat)
    updateChatEngineModel()

    // and run it
    runAgent(agent.value, values)

  })

}

const runAgent = async (agent: Agent, values: Record<string, string>, a2aContext?: A2APromptOpts) => {

  // capture the current session for this generation (allows parallel chats)
  const session = activeSession.value
  if (!session) return
  const sessionChatId = session.assistant.chat.uuid

  // create abort controller for this session
  session.abortController = new AbortController()
  setSessionStatus(sessionChatId, 'generating')

  // create executor for this agent
  const executor = createAgentExecutor(store.config, store.workspace.uuid, agent)

  await executor.run('manual', values, {
    streaming: true,
    ephemeral: false,
    model: session.assistant.chat.model,
    chat: session.assistant.chat,
    a2aContext: a2aContext,
    abortSignal: session.abortController.signal,
  }, async (event: GenerationEvent) => {

    if (event === 'before_generation') {

      // not very nice but gets the message list scrolling (only for active session)
      if (sessionChatId === activeSessionId.value) {
        latestChunk.value = {
          type: 'content',
          text: '',
          done: false,
        } as LlmChunkContent
      }

      // make sure the chat is part of history
      if (!session.assistant.chat.temporary && !store.history.chats.find((c) => c.uuid === session.assistant.chat.uuid)) {
        session.assistant.chat.initTitle()
        store.addChat(session.assistant.chat)
      }

    } else if (event === 'before_title') {
      store.saveHistory()
    }

  })

  // generation complete - update status and cleanup if not active
  setSessionStatus(sessionChatId, 'idle')
  if (sessionChatId !== activeSessionId.value) {
    delete sessions.value[sessionChatId]
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
  activeSession.value?.abortController?.abort()
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

const onComputerUseMode = () => {
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
    latestChunk.value = null
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
