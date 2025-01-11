
<template>
  <div class="content" :class="{ standalone: standalone }">
    <div class="toolbar">
      <div class="title" v-if="chat?.messages.length">{{ chat?.title }}</div>
      <div class="menu" @click="onMenu" v-if="chat">
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
    <MessageList :chat="chat" :conversation-mode="conversationMode" v-if="chat?.messages.length > 1"/>
    <EmptyChat v-else />
    <Prompt :chat="chat" :conversation-mode="conversationMode" class="prompt" />
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
import LlmFactory from '../llms/llm'
import Chat from '../models/chat'
import html2canvas from 'html2canvas'
import html2pdf from 'html2pdf.js'

import useEventBus from '../composables/event_bus'
const { emitEvent, onEvent } = useEventBus()

const llmFactory = new LlmFactory(store.config)

const props = defineProps({
  chat: {
    type: Chat,
    default: null,
    // required: true,
  },
  standalone: {
    type: Boolean,
    default: false,
  }
})

const chatMenuPosition = computed(() => {
  return window.api.platform == 'windows' ? 'left' : 'right'
})

const chatMenuActions = computed(() => {
  return [
    props.chat.engine ? { label: `${llmFactory.getEngineName(props.chat.engine)} ${props.chat.model}`, disabled: true } : null,
    { label: props.chat.disableTools ? 'Enable plugins' : 'Disable plugins', action: 'toogleTools', disabled: false },
    props.standalone ? { label: 'Save', action: 'save', disabled: saved.value } : null,
    { label: 'Rename Chat', action: 'rename', disabled: false },
    { label: 'Export as PDF', action: 'exportPdf', disabled: false },
    { label: 'Delete', action: 'delete', disabled: props.standalone && !saved.value },
  ].filter((a) => a != null)
})

const conversationMode: Ref<string> = ref('')
const showChatMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const saved = ref(false)

onMounted(() => {
  onEvent('conversation-mode', (mode: string) => conversationMode.value = mode)
})

const onMenu = () => {
  showChatMenu.value = true
  menuX.value = 16 + (chatMenuPosition.value == 'left' ? document.querySelector<HTMLElement>('.sidebar')!.offsetWidth : 0) 
  menuY.value = 32
}

const closeChatMenu = () => {
  showChatMenu.value = false
}

const handleActionClick = async (action: string) => {

  // close
  closeChatMenu()

  // process
  if (action === 'rename') {
    emitEvent('rename-chat', props.chat)
  } else if (action === 'delete') {
    emitEvent('delete-chat', props.chat.uuid)
  } else if (action == 'save') {
    onSave()
  } else if (action == 'exportPdf') {
    onExportPdf()
  } else if (action == 'toogleTools') {
    props.chat.disableTools = !props.chat.disableTools
  }
}

const onSave = () => {
  if (saved.value) return
  store.history.chats.push(props.chat)
  store.saveHistory()
  saved.value = true
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

.content {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

.toolbar {
  padding: 16px;
  -webkit-app-region: drag;
  display: grid;
  grid-template-columns: auto 16px;
  background-color: var(--message-list-bg-color);
}

.toolbar:has(.title) {
  background-color: var(--chatarea-toolbar-bg-color);
}

.toolbar .title {
  grid-column: 1;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--chatarea-toolbar-text-color);
}

.toolbar .menu {
  -webkit-app-region: no-drag;
  grid-column: 2;
  cursor: pointer;
  text-align: right;
  width: 16px;
  height: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.toolbar .menu div {
  width: 16px;
  height: 1.5px;
  background-color: var(--chatarea-toolbar-icon-color);
}

.prompt {
  background-color: var(--message-list-bg-color);
}

.windows .toolbar {
  grid-template-columns: 16px auto;
}

.windows .toolbar .title {
  margin-left: 8px;
  grid-column: 2;
  order: 2;
}

.windows .toolbar .menu {
  margin-top: 4px;
  grid-column: 1;
  order: 1;
}

.macos .content.standalone .toolbar {
  padding-left: 80px;
}

</style>
