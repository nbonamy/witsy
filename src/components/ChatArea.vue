<template>
  <div class="chat-area sp-main">
    <header :class="{ 'is-left-most': isLeftMost }">
      
      <div class="icon toggle-sidebar" v-tooltip="{ text: t('main.toggleSidebar'), position: 'bottom-right' }" @click="toggleSideBar">
        <PanelRightCloseIcon v-if="isLeftMost" />
        <PanelRightOpenIcon v-else />
      </div>

      <div class="icon new-chat" v-if="isLeftMost"v-tooltip="{ text: t('common.newChat'), position: 'bottom-right' }" @click="onNewChat">
        <MessageCirclePlusIcon />
      </div>

      <!-- <div class="icon run-agent" :class="{ hidden: !isLeftMost }" v-tooltip="{ text: t('common.runAgent'), position: 'bottom-right' }" @click="onRunAgent">
        <IconRunAgent />
      </div> -->

      <div class="title" @dblclick="onRenameChat">{{ chat?.title || '&nbsp;' }}</div>
      <div class="spacer"></div>
      <SlidersHorizontalIcon class="icon settings" @click="showModelSettings = !showModelSettings" v-if="store.isFeatureEnabled('chat.settings')" />
      <EllipsisVerticalIcon class="icon menu" @click="onMenu" v-if="chat?.title || store.isFeatureEnabled('chat.temporary')" /> 
    
  </header>
    <main>
      <div class="chat-content">
        
        <!-- <div class="chat-content-title">
          <div class="title" @dblclick="onRenameChat">{{ chat?.title || '&nbsp;' }}</div>
          <div class="spacer"></div> -->
          <!-- <SlidersHorizontalIcon class="icon settings" @click="showModelSettings = !showModelSettings" /> -->
          <!-- <EllipsisVerticalIcon class="icon" @click="onMenu" />
        </div> -->
        
        <MessageList class="chat-content-main" :chat="chat" :conversation-mode="conversationMode" v-if="chat?.hasMessages()"/>
        
        <EmptyChat2 class="chat-content-main" @run-agent="onRunAgent" v-else />
        
        <div class="deep-research-usage" v-if="prompt?.isDeepResearchActive() && tipsManager.isTipAvailable('deepResearchUsage')">
          {{  t('deepResearch.usage') }}
          <div class="deep-research-usage-close" @click="onHideDeepResearchUsage">
            <X />
          </div>
        </div>
        
        <Prompt :chat="chat" :conversation-mode="conversationMode" :history-provider="historyProvider" :enable-deep-research="true" class="prompt" @prompt="onSendPrompt" @run-agent="onRunAgent" @stop="onStopGeneration" ref="prompt" />
      
      </div>
      
      <ModelSettings class="model-settings" :class="{ visible: showModelSettings }" :chat="chat"/>
    
    </main>
    
    <ContextMenu v-if="showChatMenu" @close="closeChatMenu" :actions="chatMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" :position="chatMenuPosition"/>
  
  </div>
</template>

<script setup lang="ts">

import { EllipsisVerticalIcon, MessageCirclePlusIcon, PanelRightCloseIcon, PanelRightOpenIcon, SlidersHorizontalIcon, X } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import Dialog from '../composables/dialog'
import Chat from '../models/chat'
import ModelSettings from '../screens/ModelSettings.vue'
import { t } from '../services/i18n'
import { exportToPdf } from '../services/pdf'
import { kMediaChatId, store } from '../services/store'
import { Expert, Message } from '../types/index'
import ContextMenu, { MenuPosition } from './ContextMenu.vue'
import EmptyChat2 from './EmptyChat2.vue'
import MessageList from './MessageList.vue'
import Prompt, { SendPromptParams } from './Prompt.vue'

import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

import useTipsManager from '../composables/tips_manager'
const tipsManager = useTipsManager(store)

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
  return /*window.api.platform == 'win32' ? 'left' :*/ 'right'
})

const chatMenuActions = computed(() => {
  return [
    ...(store.isFeatureEnabled('chat.temporary') ? [
      { label: props.chat?.temporary ? t('chat.actions.saveChat') : t('chat.actions.makeTemporary'), action: 'toggle_temp', disabled: false },
    ] : []),
    { label: t('common.rename'), action: 'rename', disabled: false },
    ...(store.isFeatureEnabled('chat.exportMarkdown') ? [
      { label: t('chat.actions.exportMarkdown'), action: 'exportMarkdown', disabled: !hasMessages() },
    ] : []),
    ...(store.isFeatureEnabled('chat.exportPdf') ? [
      { label: t('chat.actions.exportPdf'), action: 'exportPdf', disabled: !hasMessages() },
    ] : []),
    { label: t('common.delete'), action: 'delete', disabled: !isSaved() },
  ].filter((a) => a != null)
})

const isSaved = () => {
  return store.history.chats.some((c) => c.uuid == props.chat.uuid)
}

const hasMessages = () => {
  return props.chat.hasMessages()
}

const historyProvider = (event: KeyboardEvent): string[] => {

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
const showChatMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const emit = defineEmits(['prompt', 'run-agent', 'stop-generation'])

onMounted(() => {
  onEvent('conversation-mode', (mode: string) => conversationMode.value = mode)
})

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

const onMenu = () => {
  showChatMenu.value = true
  menuX.value = 24 + (chatMenuPosition.value == 'below' ? document.querySelector<HTMLElement>('.sidebar')!.offsetWidth : 0) 
  menuY.value = 100 + (window.api.platform == 'win32' ? 18 : 4)
}

const closeChatMenu = () => {
  showChatMenu.value = false
}

const handleActionClick = async (action: string) => {

  // close
  closeChatMenu()

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

.macos .split-pane .sp-main header.is-left-most {
  padding-left: 40px;
}

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
        margin-right: 8px;
      }

      svg {
        width:var(--icon-lg);
        height: var(--icon-lg);
      }

      .icon {
        &.hidden {
          display: none;
        }
      }

      .new-chat {
        position: relative;
        top: -1px;
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
  
  flex: 0 0 0px;
  transition: flex-basis 0.15s ease-in-out;
  overflow: hidden;

  &:deep() label {
    white-space: nowrap;
  }

  &.visible {
    flex: 0 0 var(--info-panel-width);
  }
}
</style>
