<template>
  <div class="chat-area sp-main">
    <header :class="{ 'is-left-most': isLeftMost }">
      
      <ButtonIcon class="toggle-sidebar" v-tooltip="{ text: t('main.toggleSidebar'), position: 'bottom-right' }" @click="toggleSideBar">
        <PanelRightCloseIcon v-if="isLeftMost" />
        <PanelRightOpenIcon v-else />
      </ButtonIcon>

      <ButtonIcon class="new-chat" v-if="isLeftMost" v-tooltip="{ text: t('common.newChat'), position: 'bottom-right' }" @click="onNewChat">
        <MessageCirclePlusIcon />
      </ButtonIcon>

      <!-- <div class="icon run-agent" :class="{ hidden: !isLeftMost }" v-tooltip="{ text: t('common.runAgent'), position: 'bottom-right' }" @click="onRunAgent">
        <IconRunAgent />
      </div> -->

      <div class="title" @dblclick="onRenameChat">{{ chat?.title || '&nbsp;' }}</div>
      <div class="spacer"></div>

      <ButtonIcon class="settings" @click="showModelSettings = !showModelSettings" v-if="store.isFeatureEnabled('chat.settings')">
        <SlidersHorizontalIcon />
      </ButtonIcon>

      <ContextMenuTrigger class="menu" :position="chatMenuPosition" v-if="chat?.title || store.isFeatureEnabled('chat.temporary')">
        <template #trigger>
          <MoreVerticalIcon />
        </template>
        <template #menu>
          <div v-if="store.isFeatureEnabled('chat.temporary')"
               class="item"
               @click="handleActionClick('toggle_temp')">
            {{ chat?.temporary ? t('chat.actions.saveChat') : t('chat.actions.makeTemporary') }}
          </div>
          <div class="item" @click="handleActionClick('rename')">
            {{ t('common.rename') }}
          </div>
          <div v-if="store.isFeatureEnabled('chat.exportMarkdown')"
               class="item"
               :class="{ disabled: !hasMessages() }"
               @click="hasMessages() && handleActionClick('exportMarkdown')">
            {{ t('chat.actions.exportMarkdown') }}
          </div>
          <div v-if="store.isFeatureEnabled('chat.exportPdf')"
               class="item"
               :class="{ disabled: !hasMessages() }"
               @click="hasMessages() && handleActionClick('exportPdf')">
            {{ t('chat.actions.exportPdf') }}
          </div>
          <div class="item"
               :class="{ disabled: !hasUsage() }"
               @click="hasUsage() && handleActionClick('usage')">
            {{ t('chat.actions.usage') }}
          </div>
          <div class="item"
               :class="{ disabled: !isSaved() }"
               @click="isSaved() && handleActionClick('delete')">
            {{ t('common.delete') }}
          </div>
        </template>
      </ContextMenuTrigger>

  </header>
    <main>
      <div class="chat-content">
        
        <!-- <div class="chat-content-title">
          <div class="title" @dblclick="onRenameChat">{{ chat?.title || '&nbsp;' }}</div>
          <div class="spacer"></div> -->
          <!-- <SlidersHorizontalIcon class="icon settings" @click="showModelSettings = !showModelSettings" /> -->
          <!-- <MoreVerticalIcon class="icon" @click="onMenu" />
        </div> -->
        
        <MessageList class="chat-content-main" :chat="chat" :conversation-mode="conversationMode" v-if="chat?.hasMessages()"/>
        
        <EmptyChat class="chat-content-main" @run-agent="onRunAgent" v-else />
        
        <div class="deep-research-usage" v-if="prompt?.isDeepResearchActive() && tipsManager.isTipAvailable('deepResearchUsage')">
          {{  t('deepResearch.usage') }}
          <div class="deep-research-usage-close" @click="onHideDeepResearchUsage">
            <X />
          </div>
        </div>
        
        <Prompt :chat="chat" :conversation-mode="conversationMode" :history-provider="historyProvider" :enable-deep-research="true" class="prompt" @set-engine-model="onSetEngineModel" @prompt="onSendPrompt" @run-agent="onRunAgent" @stop="onStopGeneration" ref="prompt" />
      
      </div>
      
      <ModelSettings class="model-settings" :class="{ visible: showModelSettings }" :chat="chat" @close="showModelSettings = false"/>
    
    </main>

  </div>
</template>

<script setup lang="ts">

import useEventBus from '@composables/event_bus'
import Chat from '@models/chat'
import Dialog from '@renderer/utils/dialog'
import useTipsManager from '@renderer/utils/tips_manager'
import ModelSettings from '@screens/ModelSettings.vue'
import { t } from '@services/i18n'
import LlmFactory, { ILlmManager } from '@services/llms/llm'
import { exportToPdf } from '@services/pdf'
import { kMediaChatId, store } from '@services/store'
import { MessageCirclePlusIcon, MoreVerticalIcon, PanelRightCloseIcon, PanelRightOpenIcon, SlidersHorizontalIcon, X } from 'lucide-vue-next'
import { Expert, Message } from 'types/index'
import { computed, onMounted, ref } from 'vue'
import ButtonIcon from './ButtonIcon.vue'
import { MenuPosition } from './ContextMenuPlus.vue'
import ContextMenuTrigger from './ContextMenuTrigger.vue'
import EmptyChat from './EmptyChat.vue'
import MessageList from './MessageList.vue'
import Prompt, { SendPromptParams } from './Prompt.vue'
  
const { emitEvent, onEvent } = useEventBus()
const tipsManager = useTipsManager(store)
const llmManager: ILlmManager = LlmFactory.manager(store.config)

const props = defineProps({
  chat: {
    type: Chat,
    required: true,
  },
  isLeftMost: {
    type: Boolean,
    default: false,
  }
})

const chatMenuPosition = computed((): MenuPosition => {
  return /*window.api.platform == 'win32' ? 'left' :*/ 'below-right'
})

const isSaved = () => {
  return store.history.chats.some((c) => c.uuid == props.chat.uuid)
}

const hasMessages = () => {
  return props.chat.hasMessages()
}

const hasUsage = () => {
  return props.chat.messages.some(m => m.usage)
}

const historyProvider = (): string[] => {

  // start with chat messages
  const chatMessages = props.chat?.messages.filter(m => m.role === 'user') || []

  // add messages from other chats
  const otherMessages = store.history.chats.reduce((acc, chat) => {
    if (chat.uuid !== props.chat.uuid && chat.uuid != kMediaChatId) {
      return acc.concat(chat.messages.filter(m => m.role === 'user'))
    }
    return acc
  }, []).sort((a, b) => a.createdAt - b.createdAt)

  // we need only the content
  const history: string[] = [
    ...otherMessages,
    ...chatMessages,
  ].map((m) => m.content).filter((m) => m.trim() !== '')

  // now dedup preserving the order
  return Array.from(new Set(history))

}

const prompt= ref<typeof Prompt>(null)
const conversationMode= ref<string>('')
const showModelSettings = ref(false)

const emit = defineEmits(['prompt', 'run-agent', 'stop-generation'])

onMounted(() => {
  onEvent('conversation-mode', (mode: string) => conversationMode.value = mode)
})

const onSetEngineModel = (engine: string, model: string) => {
  llmManager.setChatModel(engine, model)
}

const onSendPrompt = (payload: SendPromptParams) => {
  emit('prompt', payload)
}

const onRunAgent = (...args: any[]) => {
  emit('run-agent', ...args)
}

const onStopGeneration = () => {
  emit('stop-generation', null)
}

const toggleSideBar = () => {
  emitEvent('toggle-sidebar')
}

const onNewChat = () => {
  emitEvent('new-chat')
}

const onRenameChat = () => {
  emitEvent('rename-chat', props.chat)
}

const handleActionClick = async (action: string) => {

  // process
  if (action === 'toggle_temp') {
    onToggleTemporary()
  } else if (action === 'rename') {
    emitEvent('rename-chat', props.chat)
  } else if (action === 'delete') {
    emitEvent('delete-chat', props.chat.uuid)
  } else if (action == 'exportMarkdown') {
    onExportMarkdown()
  } else if (action == 'exportPdf') {
    onExportPdf()
  } else if (action == 'usage') {
    onShowUsage()
  } else if (action == 'modelSettings') {
    showModelSettings.value = !showModelSettings.value
  }
}

const onToggleTemporary = () => {
  if (props.chat.temporary) {
    props.chat.temporary = false
    if (props.chat.hasMessages()) {
      store.addChat(props.chat)
    }
  } else {
    props.chat.temporary = true
    store.removeChat(props.chat)
  }
}

const onExportMarkdown = async () => {
  try {
    let content = `# ${props.chat.title}\n\n`
    for (const message of props.chat.messages) {
      content += `## ${t('chat.role.' + message.role)}\n\n${message.content}\n\n`
    }
    window.api.file.save({
      contents: window.api.base64.encode(content),
      url: `${props.chat.title}.md`,
      properties: {
        directory: 'documents',
        prompt: true,
      }
    })
  } catch (e) {
    console.error('Error exporting Markdown:', e)
    Dialog.show({
      title: t('common.error'),
      text: t('chat.export.error'),
    })
  }
}

const onExportPdf = async () => {
  try {
    
    // Prepare the chat area element for PDF export
    const chatArea = document.querySelector<HTMLElement>('.chat-area')
    if (!chatArea) {
      throw new Error('Chat area not found')
    }

    // Clone and clean up the content
    const content = chatArea.cloneNode(true) as HTMLElement
    content.querySelectorAll('header .icon')?.forEach(icon => icon.remove())
    content.querySelectorAll('.message .tool-container')?.forEach(tool => tool.remove())
    content.querySelector('.model-settings')?.remove()
    content.querySelector('.message .actions')?.remove()
    content.querySelector('.overflow')?.remove()
    content.querySelector('.prompt')?.remove()

    // Remove scroll styling
    content.style.height = 'auto'
    const mainElement = content.querySelector<HTMLElement>('main')
    if (mainElement) {
      mainElement.style.height = 'auto'
      mainElement.style.overflow = 'visible'
    }

    // Adjust header margins
    const headerElement = content.querySelector<HTMLElement>('header')
    if (headerElement) {
      headerElement.style.marginLeft = '12px'
      headerElement.style.marginRight = '12px'
    }

    // Export to PDF using the service
    await exportToPdf({
      title: props.chat.title,
      element: content
    })

  } catch (e) {
    console.error('Error exporting PDF:', e)
    Dialog.show({
      title: t('common.error'),
      text: t('chat.export.error'),
    })
  }
}

const onShowUsage = () => {

  // Calculate total usage across all messages
  const totalUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    cached_tokens: 0,
    reasoning_tokens: 0,
  }

  for (const message of props.chat.messages) {
    if (message.usage) {
      totalUsage.prompt_tokens += message.usage.prompt_tokens || 0
      totalUsage.completion_tokens += message.usage.completion_tokens || 0
      if (message.usage.prompt_tokens_details?.cached_tokens) {
        totalUsage.cached_tokens += message.usage.prompt_tokens_details.cached_tokens
      }
      if (message.usage.completion_tokens_details?.reasoning_tokens) {
        totalUsage.reasoning_tokens += message.usage.completion_tokens_details.reasoning_tokens
      }
    }
  }

  // Build text in the same format as message usage
  const totalTokens = totalUsage.prompt_tokens + totalUsage.completion_tokens
  const text = [
    t('message.actions.usage.prompt', { prompt: totalUsage.prompt_tokens }),
    totalUsage.cached_tokens ?
      t('message.actions.usage.cached', { cached: totalUsage.cached_tokens }) :
      null,
    t('message.actions.usage.response', { completion: totalUsage.completion_tokens }),
    totalUsage.reasoning_tokens ?
      t('message.actions.usage.reasoning', { reasoning: totalUsage.reasoning_tokens }) :
      null,
  ].filter(Boolean).join('<br/>')

  Dialog.show({
    title: t('message.actions.usage.title', { total: totalTokens }),
    html: text,
  })
}

const onHideDeepResearchUsage = () => {
  tipsManager.setTipShown('deepResearchUsage')
}

defineExpose({

  focusPrompt: () => {
    prompt.value?.focus()
  },

  setPrompt: (userPrompt: string|Message) => {
    prompt.value.setPrompt(userPrompt)
  },

  attach: (attachment: File) => {
    prompt.value.attach(attachment)
  },

  setExpert: (expert: Expert) => {
    prompt.value.setExpert(expert)
  },

  setDeepResearch: (active: boolean) => {
    prompt.value.setDeepResearch(active)
  },

  startDictation: () => {
    prompt.value.startDictation()
  },

  sendPrompt: () => {
    prompt.value.sendPrompt()
  },

})

</script>


<style scoped>

.split-pane {
  
  .sp-main {

    background-color: var(--message-list-bg-color);

    header {

      display: flex;
      flex-direction: row;
      align-items: center;

      .spacer {
        flex: 1;
        height: 100%;
      }

      .title {
        flex: 0 1 auto;
      }

      .icon {
        &.hidden {
          display: none;
        }
      }

      .toggle-sidebar {
        position: relative;
        top: -2px;
      }

      .new-chat {
        position: relative;
        top: -2px;
      }

    }

    main {

      flex-direction: row;

      .chat-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        max-width: 100%;
        background-color: var(--message-list-bg-color);

        .deep-research-usage {
          padding: 1rem 1.5rem;
          padding-bottom: 0rem;
          color: var(--faded-text-color);
          height: auto;
          border-top: 1px solid var(--sidebar-border-color);

          display: flex;
          align-items: center;
          gap: 2rem;

          .deep-research-usage-close {
            cursor: pointer;
            font-size: 18.5px;
          }
        }

        &:deep() .chat-content-main {
          flex: 1;
        }

        &:deep() .prompt {
          margin: 1.5rem;
        }
      }

    }


  }

}

.model-settings {

  position: absolute;
  top: var(--window-toolbar-height);
  bottom: var(--window-footer-height);
  right: -1px;
  
  width: 0px;
  transition: width 0.15s ease-in-out;
  overflow: hidden;

  &:deep() label {
    white-space: nowrap;
  }

  &.visible {
    width: var(--info-panel-width);
  }
}
</style>
