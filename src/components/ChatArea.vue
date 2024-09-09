
<template>
  <div class="content" :class="{ standalone: standalone }">
    <div class="toolbar">
      <div class="title" v-if="chat?.messages.length">{{ chat?.title }}</div>
      <div class="menu" @click="onMenu" v-if="chat"></div>
    </div>
    <MessageList :chat="chat" v-if="chat?.messages.length > 1"/>
    <EmptyChat v-else />
    <Prompt :chat="chat" class="prompt" />
    <ContextMenu v-if="showChatMenu" :on-close="closeChatMenu" :actions="chatMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" :align="chatMenuAlign"/>
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'
import { store } from '../services/store'
import ContextMenu from './ContextMenu.vue'
import Chat from '../models/chat'
import MessageList from './MessageList.vue'
import Prompt from './Prompt.vue'
import useEventBus from '../composables/useEventBus'
import EmptyChat from './EmptyChat.vue'
import html2pdf from 'html2pdf.js'
const { emitEvent } = useEventBus()

const props = defineProps({
  chat: Chat,
  standalone: Boolean,
})

const chatMenuAlign = computed(() => {
  return window.platform == 'windows' ? 'left' : 'right'
})

const chatMenuActions = computed(() => {
  return [
    props.chat.engine ? { label: `${props.chat.engine} ${props.chat.model}`, disabled: true } : null,
    props.standalone ? { label: 'Save', action: 'save', disabled: saved.value } : null,
    { label: 'Rename Chat', action: 'rename', disabled: false },
    { label: 'Export as PDF', action: 'exportPdf', disabled: false },
    { label: 'Delete', action: 'delete', disabled: props.standalone && !saved.value },
  ].filter((a) => a != null)
})

const showChatMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const saved = ref(false)

const onMenu = () => {
  showChatMenu.value = true
  menuX.value = 16 + (chatMenuAlign.value == 'left' ? document.querySelector('.sidebar').offsetWidth : 0) 
  menuY.value = 32
}

const closeChatMenu = () => {
  showChatMenu.value = false
}

const handleActionClick = async (action) => {

  // close
  closeChatMenu()

  // process
  if (action === 'rename') {
    emitEvent('renameChat', props.chat)
  } else if (action === 'delete') {
    emitEvent('deleteChat', props.chat.uuid)
  } else if (action == 'save') {
    onSave()
  } else if (action == 'exportPdf') {
    onExportPdf()
  }
}

const onSave = () => {
  if (saved.value) return
  store.chats.push(props.chat)
  store.saveHistory()
  saved.value = true
}

const onExportPdf = async () => {
  // copy and clean-up
  const content = document.querySelector('.content').cloneNode(true)
  content.querySelector('.toolbar .menu')?.remove()
  content.querySelector('.message .actions')?.remove()
  content.querySelector('.overflow')?.remove()
  content.querySelector('.prompt')?.remove()

  // now remove scroll
  content.style.height = 'auto'
  content.querySelector('.container').style.height = 'auto'
  content.querySelector('.container').style.overflow = 'visible'

  // adjust title
  //content.querySelector('.toolbar').style.marginTop = '-12px'
  content.querySelector('.toolbar').style.marginLeft = '12px'
  content.querySelector('.toolbar').style.marginRight = '12px'

  // render svg logos as png (for some of them)
  // this is not nice but it works for now
  content.querySelectorAll('.message .logo').forEach(async (logo) => {
    let src = logo.getAttribute('src')
    src = src.replace('openai.svg', 'openai.png')
    src = src.replace('ollama.svg', 'ollama.png')
    src = src.replace('groq.svg', 'groq.png')
    logo.setAttribute('src', src)
  })

  // replace images with their b64 version
  content.querySelectorAll('.message .body img').forEach((img) => {
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
  html2pdf().from(content).set(opt).save()
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
}

.toolbar:has(.title) {
  background-color: #F4F4F2;
}

.toolbar .title {
  grid-column: 1;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar .menu {
  -webkit-app-region: no-drag;
  grid-column: 2;
  cursor: pointer;
  text-align: right;
  width: 16px;
  height: 16px;
  background-image: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjwhRE9DVFlQRSBzdmcgIFBVQkxJQyAnLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4nICAnaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkJz48c3ZnIGhlaWdodD0iMzJweCIgaWQ9IkxheWVyXzEiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDMyIDMyOyIgdmVyc2lvbj0iMS4xIiB2aWV3Qm94PSIwIDAgMzIgMzIiIHdpZHRoPSIzMnB4IiB4bWw6c3BhY2U9InByZXNlcnZlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48cGF0aCBkPSJNNCwxMGgyNGMxLjEwNCwwLDItMC44OTYsMi0ycy0wLjg5Ni0yLTItMkg0QzIuODk2LDYsMiw2Ljg5NiwyLDhTMi44OTYsMTAsNCwxMHogTTI4LDE0SDRjLTEuMTA0LDAtMiwwLjg5Ni0yLDIgIHMwLjg5NiwyLDIsMmgyNGMxLjEwNCwwLDItMC44OTYsMi0yUzI5LjEwNCwxNCwyOCwxNHogTTI4LDIySDRjLTEuMTA0LDAtMiwwLjg5Ni0yLDJzMC44OTYsMiwyLDJoMjRjMS4xMDQsMCwyLTAuODk2LDItMiAgUzI5LjEwNCwyMiwyOCwyMnoiLz48L3N2Zz4=');
  background-position: 0px -1px;
  background-size: 16px;
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
