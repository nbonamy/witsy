
<template>
  <div class="content">
    <div class="toolbar">
      <div class="title">
        {{ chat.title }}
      </div>
    </div>
    <MessageList :messages="chat.messages" v-if="chat.messages.length > 1"/>
    <div v-else class="empty">
      <img :src="logo" class="logo" />
      <p class="version">{{ model }}</p>
    </div>
    <Prompt class="prompt" />
  </div>
</template>

<script setup>

import { computed } from 'vue'
import { store } from '../services/store'
import Chat from '../models/chat'
import MessageList from './MessageList.vue'
import Prompt from './Prompt.vue'

const props = defineProps({
  chat: Chat
})

//
// we cannot use store.config.getActiveModel here
// because we will lose reactivity :-(
//

const logo = computed(() => {
  return `/assets/${store.config.llm.engine}.svg`
})

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
}

.title {
  font-weight: bold;
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
