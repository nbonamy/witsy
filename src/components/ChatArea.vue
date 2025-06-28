<template>
  <div class="chat-area content">
    <header :class="{ 'is-left-most': isLeftMost }">
      <IconSideBar class="icon toggle-sidebar" @click="toggleSideBar" />
      <IconNewChat class="icon new-chat" :class="{ hidden: !isLeftMost }" @click="onNewChat" />
      <div class="title" @dblclick="onRenameChat">{{ chat?.title || '&nbsp;' }}</div>
      <div class="spacer"></div>
      <BIconSliders class="icon settings" @click="showModelSettings = !showModelSettings" />
      <IconMenu class="icon" @click="onMenu" />
    </header>
    <main>
      <div class="chat-content">
        <MessageList :chat="chat" :conversation-mode="conversationMode" v-if="chat?.hasMessages()"/>
        <EmptyChat v-else />
        <Prompt :chat="chat" :conversation-mode="conversationMode" :history-provider="historyProvider" :enable-deep-research="enableDeepResearch" class="prompt" ref="prompt" />
      </div>
      <ModelSettings class="model-settings" :class="{ visible: showModelSettings }" :chat="chat"/>
    </main>
    <ContextMenu v-if="showChatMenu" :on-close="closeChatMenu" :actions="chatMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" :position="chatMenuPosition"/>
  </div>
</template>

<script setup lang="ts">

import { Expert } from '../types/index'
import { Ref, ref, computed, onMounted } from 'vue'
import { kMediaChatId, store } from '../services/store'
import { t } from '../services/i18n'
import ContextMenu from './ContextMenu.vue'
import MessageList from './MessageList.vue'
import EmptyChat from './EmptyChat.vue'
import Prompt from './Prompt.vue'
import ModelSettings from '../screens/ModelSettings.vue'
import Chat from '../models/chat'
import html2canvas from 'html2canvas'
import html2pdf from 'html2pdf.js'
import IconSideBar from '../../assets/sidebar.svg?component'
import IconNewChat from './IconNewChat.vue'
import IconMenu from './IconMenu.vue'

import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

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

const enableDeepResearch = computed(() => {
  return store.config.features?.deepResearch
})

const chatMenuPosition = computed(() => {
  return /*window.api.platform == 'win32' ? 'left' :*/ 'right'
})

const chatMenuActions = computed(() => {
  return [
    { label: props.chat?.temporary ? t('chat.actions.saveChat') : t('chat.actions.makeTemporary'), action: 'toggle_temp', disabled: false },
    { label: t('common.rename'), action: 'rename', disabled: false },
    { label: t('chat.actions.exportMarkdown'), action: 'exportMarkdown', disabled: !hasMessages() },
    { label: t('chat.actions.exportPdf'), action: 'exportPdf', disabled: !hasMessages() },
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

const prompt: Ref<typeof Prompt> = ref(null)
const conversationMode: Ref<string> = ref('')
const showModelSettings = ref(false)
const showChatMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)

onMounted(() => {
  onEvent('conversation-mode', (mode: string) => conversationMode.value = mode)
})

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
  menuX.value = 16 + (chatMenuPosition.value == 'left' ? document.querySelector<HTMLElement>('.sidebar')!.offsetWidth : 0) 
  menuY.value = 32 + (window.api.platform == 'win32' ? 18 : 4)
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
    window.api.showDialog({
      message: t('common.error'),
      detail: t('chat.export.error'),
    })
  }
}

const onExportPdf = async () => {

  const theme = store.config.appearance.theme
  const image = document.createElement('img')

  try {
    
    // first take a screenshot so that theme flickering is invisible to user
    const canvas = await html2canvas(document.documentElement)

    // add to body
    image.style.position = 'absolute'
    image.style.top = '0'
    image.style.left = '0'
    image.style.width = '100%'
    image.style.zIndex = '10000'
    image.src = canvas.toDataURL()
    document.body.appendChild(image)

    // switch to light for export
    window.api.setAppearanceTheme('light')

    // copy and clean-up
    const content: HTMLElement = document.querySelector<HTMLElement>('.chat-area').cloneNode(true) as HTMLElement
    content.querySelectorAll('header .icon')?.forEach(icon => icon.remove())
    content.querySelectorAll('.message .tool-container')?.forEach(tool => tool.remove())
    content.querySelector('.model-settings')?.remove()
    content.querySelector('.message .actions')?.remove()
    content.querySelector('.overflow')?.remove()
    content.querySelector('.prompt')?.remove()

    // now remove scroll
    content.style.height = 'auto'
    content.querySelector<HTMLElement>('main').style.height = 'auto'
    content.querySelector<HTMLElement>('main').style.overflow = 'visible'

    // adjust title
    //content.querySelector<HTMLElement>('header').style.marginTop = '-12px'
    content.querySelector<HTMLElement>('header').style.marginLeft = '12px'
    content.querySelector<HTMLElement>('header').style.marginRight = '12px'

    // replace images with their b64 version
    content.querySelectorAll<HTMLImageElement>('.message .body img').forEach((img) => {
      const src = img.src
      if (src.startsWith('file://')) {
        const path = decodeURIComponent(src.replace('file://', ''))
        const data = window.api.file.read(path)
        if (data) {
          img.src = `data:${data.mimeType};base64,${data.contents}`
        }
      }
    })

    // now render
    const opt = {
      margin: [ 12, 4, 8, 4 ],
      filename: `${props.chat.title}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { scale: 2 },
      pagebreak: { mode: 'avoid-all' },
      jsPDF: { compress: true, putOnlyUsedFonts: true }
    }
    await html2pdf().from(content).set(opt).save()
    

  } catch (e) {
    console.error('Error exporting PDF:', e)
    window.api.showDialog({
      message: t('common.error'),
      detail: t('chat.export.error'),
    })
  }

  // restore theme
  window.api.setAppearanceTheme(theme)

  // remove image
  await new Promise((resolve) => setTimeout(resolve, 500));
  document.body.removeChild(image)

}

defineExpose({

  setExpert: (expert: Expert) => {
    prompt.value.setExpert(expert)
  },

  setDeepResearch: (active: boolean) => {
    prompt.value.setDeepResearch(active)
  },

  startDictation: () => {
    prompt.value.startDictation()
  },

})

</script>

<style scoped>
@import '../../css/panel-content.css';
</style>

<style scoped>

.macos .content header.is-left-most {
  padding-left: 40px;
}

.windows .panel-content .content header .toggle-sidebar {
  top: -4.5px;
}

.panel-content {
  
  .content {

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
        /* -webkit-app-region: no-drag; */
      }

      .icon {
        margin-right: 8px;
      }

      .toggle-sidebar {
        position: relative;
        top: -1px;
        transform: scaleY(120%);
      }

      .new-chat {
        &.hidden {
          display: none;
        }
      }

    }

    main {

      flex-direction: row;

      .chat-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        max-width: 100%;

        &:deep() > div:first-child {
          flex: 1;
        }

        &:deep() .prompt {
          padding-bottom: 12px;
          margin: 1rem;
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

  }

}

</style>
