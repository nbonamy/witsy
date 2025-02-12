
<template>
  <div class="chat-area">
    <div class="toolbar" :class="{ 'is-left-most': isLeftMost }">
      <div class="action sidebar" @click="toggleSideBar">
        <IconSideBar />
      </div>
      <div class="action new-chat" :class="{ hidden: !isLeftMost }" @click="onNewChat">
        <BIconPencilSquare />
      </div>
      <div class="title" v-if="chat?.title">{{ chat.title }}</div>
      <div class="action settings" @click="showModelSettings = !showModelSettings">
        <BIconSliders />
      </div>
      <div class="action menu" @click="onMenu">
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
    <div class="inside-content">
      <div class="chat-content">
        <MessageList :chat="chat" :conversation-mode="conversationMode" v-if="chat?.hasMessages()"/>
        <EmptyChat v-else />
        <Prompt :chat="chat" :conversation-mode="conversationMode" class="prompt" />
      </div>
      <ModelSettings class="model-settings" :class="{ visible: showModelSettings }" :chat="chat"/>
    </div>
    <ContextMenu v-if="showChatMenu" :on-close="closeChatMenu" :actions="chatMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" :position="chatMenuPosition"/>
  </div>
</template>

<script setup lang="ts">

import { Ref, ref, computed, onMounted } from 'vue'
import { store } from '../services/store'
import ContextMenu from './ContextMenu.vue'
import MessageList from './MessageList.vue'
import EmptyChat from './EmptyChat.vue'
import Prompt from './Prompt.vue'
import ModelSettings from '../screens/ModelSettings.vue'
import LlmFactory from '../llms/llm'
import Chat from '../models/chat'
import html2canvas from 'html2canvas'
import html2pdf from 'html2pdf.js'
import IconSideBar from '../../assets/sidebar.svg?component'

import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

const llmFactory = new LlmFactory(store.config)

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

const chatMenuPosition = computed(() => {
  return window.api.platform == 'win32' ? 'left' : 'right'
})

const chatMenuActions = computed(() => {

  // // show default is chat not setup yet
  // let { engine, model } = llmFactory.getChatEngineModel()
  // if (props.chat.engine) {
  //   engine = llmFactory.getEngineName(props.chat.engine)
  //   model = props.chat.model
  // }

  return [
    // { label: `${engine} ${model}`, disabled: true },
    // { label: props.chat.disableTools ? 'Enable plugins' : 'Disable plugins', action: 'toogleTools', disabled: false },
    // { label: 'Model Settings', action: 'modelSettings', disabled: false },
    { label: props.chat?.temporary ? 'Save Chat' : 'Temporary Chat', action: 'toggle_temp', disabled: false },
    { label: 'Rename Chat', action: 'rename', disabled: false },
    { label: 'Export as PDF', action: 'exportPdf', disabled: !hasMessages() },
    { label: 'Delete', action: 'delete', disabled: !isSaved() },
  ].filter((a) => a != null)
})

const isSaved = () => {
  return store.history.chats.some((c) => c.uuid == props.chat.uuid)
}

const hasMessages = () => {
  return props.chat.hasMessages()
}

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

const onMenu = () => {
  showChatMenu.value = true
  menuX.value = 16 + (chatMenuPosition.value == 'left' ? document.querySelector<HTMLElement>('.sidebar')!.offsetWidth : 0) 
  menuY.value = 32 + (window.api.platform == 'win32' ? 8 : 4)
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
  } else if (action == 'exportPdf') {
    onExportPdf()
  } else if (action == 'toogleTools') {
    props.chat.disableTools = !props.chat.disableTools
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

const onExportPdf = async () => {

  // first take a screenshot so that theme flickering is invisible to user
  const canvas = await html2canvas(document.documentElement)

  // add to body
  var t = canvas.toDataURL()
  const image = document.createElement('img')
  image.style.position = 'absolute'
  image.style.top = '0'
  image.style.left = '0'
  image.style.width = '100%'
  image.style.zIndex = '10000'
  image.src = t
  document.body.appendChild(image)

  // switch to light for export
  const theme = store.config.appearance.theme
  window.api.setAppearanceTheme('light')

  // copy and clean-up
  const content: HTMLElement = document.querySelector<HTMLElement>('.content')!.cloneNode(true) as HTMLElement
  content.querySelector('.toolbar .menu')?.remove()
  content.querySelector('.message .actions')?.remove()
  content.querySelector('.overflow')?.remove()
  content.querySelector('.prompt')?.remove()

  // now remove scroll
  content.style.height = 'auto'
  content.querySelector<HTMLElement>('.container')!.style.height = 'auto'
  content.querySelector<HTMLElement>('.container')!.style.overflow = 'visible'

  // adjust title
  //content.querySelector<HTMLElement>('.toolbar')!.style.marginTop = '-12px'
  content.querySelector<HTMLElement>('.toolbar')!.style.marginLeft = '12px'
  content.querySelector<HTMLElement>('.toolbar')!.style.marginRight = '12px'

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

  // restore theme
  window.api.setAppearanceTheme(theme)

  // remove image
  await new Promise((resolve) => setTimeout(resolve, 500));
  document.body.removeChild(image)

}

</script>

<style scoped>

.macos .chat-area .toolbar.is-left-most {
  padding-left: 90px;
}

.chat-area {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: var(--message-list-bg-color);
}

.toolbar {
  padding: 16px;
  -webkit-app-region: drag;
  display: grid;
  grid-template-columns: fit-content(24px) fit-content(24px) auto fit-content(24px) fit-content(24px);
  background-color: var(--chatarea-toolbar-bg-color);

  .title {
    grid-column: 3;
    font-weight: bold;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-left: 8px;
    color: var(--chatarea-toolbar-text-color);
  }

  .action {
    -webkit-app-region: no-drag;
    cursor: pointer;
    text-align: right;
    width: 16px;
    height: 16px;
    margin-right: 8px;
    color: var(--chatarea-toolbar-icon-color);
    fill: var(--chatarea-toolbar-icon-color);
  }

  .sidebar {
    margin-top: -1.5px;
    transform: scaleY(120%);
    grid-column: 1;
  }

  .new-chat {
    grid-column: 2;
    &.hidden {
      display: none;
    }
  }

  .settings {
    grid-column: 4;
  }

  .menu {
    grid-column: 5;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;

    div {
      width: 16px;
      height: 1.5px;
      background-color: var(--chatarea-toolbar-icon-color);
    }
  }
}

.inside-content {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow-y: auto;

  .chat-content {
    flex: 1;
    display: flex;
    flex-direction: column;

    &:deep() > div:first-child {
      flex: 1;
    }

    &:deep() .prompt {
      padding-bottom: 12px;
    }
  }

}

.model-settings {
  flex: 0 0 0px;
  transition: flex-basis 0.2s ease-in-out;
  overflow: hidden;

  &:deep() label {
    white-space: nowrap;
  }

  &.visible {
    flex: 0 0 var(--info-panel-width);
  }
}

.windows {
  .toolbar {
    grid-template-columns: fit-content(24px) fit-content(24px) fit-content(24px) fit-content(24px) auto;

    .sidebar {
      grid-column: 1;
      order: 1;
    }

    .new-chat {
      margin-top: 4px;
      grid-column: 2;
      order: 2;
    }

    .menu {
      margin-top: 4px;
      grid-column: 3;
      order: 3;
    }

    .settings {
      margin-top: 3px;
      grid-column: 4;
      order: 4;
    }
    
    .title {
      margin-left: 8px;
      grid-column: 5;
      order: 5;
    }

  }
}

</style>
