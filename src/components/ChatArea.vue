
<template>
  <div class="content">
    <div class="toolbar">
      <div class="title">
        {{ chat.title }}
      </div>
    </div>
    <MessageList class="messages" :messages="chat.messages" />
    <Prompt class="prompt" />
  </div>
</template>

<script setup>

import Chat from '../models/chat'
import MessageList from './MessageList.vue'
import Prompt from './Prompt.vue'

const props = defineProps({
  chat: Chat
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


</style>
