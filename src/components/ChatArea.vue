
<template>
  <div class="content">
    <div class="toolbar">
      <div class="title">
        {{ chat.title }}
      </div>
    </div>
    <MessageList :messages="chat.messages" v-if="chat.messages.length > 1"/>
    <div v-else class="empty">
      <EngineLogo :engine="store.config.llm.engine" />
      <p class="version">{{ model }}</p>
    </div>
    <Prompt :chat="chat" class="prompt" />
  </div>
</template>

<script setup>

import { computed } from 'vue'
import { store } from '../services/store'
import Chat from '../models/chat'
import EngineLogo from './EngineLogo.vue'
import MessageList from './MessageList.vue'
import Prompt from './Prompt.vue'

const props = defineProps({
  chat: Chat
})

//
// we cannot use store.config.getActiveModel here
// because we will lose reactivity :-(
//

const model = computed(() => {
  return store.config?.[store.config.llm.engine]?.models?.chat || ''
})

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
}

.title {
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty {
  height: 100vh;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.empty .logo {
  width: 48px;
}

</style>
