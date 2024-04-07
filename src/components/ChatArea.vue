
<template>
  <div class="content" :class="{ standalone: standalone }">
    <div class="toolbar">
      <div class="title">
        {{ chat.title }}
      </div>
      <div v-if="standalone" class="action" @click="onSave">
        <BIconFloppy />
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

import { ref, computed } from 'vue'
import { store } from '../services/store'
import Chat from '../models/chat'
import EngineLogo from './EngineLogo.vue'
import MessageList from './MessageList.vue'
import Prompt from './Prompt.vue'

const props = defineProps({
  chat: Chat,
  standalone: Boolean,
})

const saved = ref(false)

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

const onSave = () => {
  if (saved.value) return
  store.chats.push(props.chat)
  store.save()
  saved.value = true
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
  padding: 15px 16px 24px;
  -webkit-app-region: drag;
  display: grid;
}

.content.standalone .toolbar {
  grid-template-columns: auto 32px;
}

.toolbar .title {
  grid-column: 1;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar .action {
  -webkit-app-region: no-drag;
  grid-column: 2;
  cursor: pointer;
  text-align: right;
}

.content.standalone .toolbar {
  padding-left: 80px;
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
