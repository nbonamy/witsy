
<template>
  <div class="content">
    <div class="toolbar">
      <div class="title">
        {{ chat.title }}
      </div>
    </div>
    <MessageList :chat="chat" v-if="chat.messages.length > 1"/>
    <div v-else class="empty">
      <EngineLogo :engine="store.config.llm.engine" />
      <select v-model="model" class="select-model" @change="onSelectModel" v-if="models">
        <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>
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

const models = computed(() => store.models[store.config.llm.engine])
const model = computed(() => store.config?.[store.config.llm.engine]?.models?.chat)

const onSelectModel = (ev) => {
  let model = ev.target.value
  store.config[store.config.llm.engine].models.chat = model
  store.save()
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

.select-model {
  border: none;
  outline: none;
  margin-top: 16px;
  padding: 0px;
  font-size: 12pt;
  text-align: center;
}
</style>
