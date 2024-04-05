<template>
  <div class="content">
    <div class="group">
      <label>Chat theme</label>
      <select v-model="general_chatTheme" @change="save">
        <option value="openai">OpenAI</option>
        <option value="conversation">Conversation</option>
      </select>
    </div>
    <div class="group">
      <label>Chat font size</label>
      <span class="fontsize small">A</span>
      <div class="slidergroup">
        <input type="range" min="1" max="5" v-model="general_fontSize" @input="save" />
        <datalist id="fontsize">
          <option value="1"></option>
          <option value="2"></option>
          <option value="3"></option>
          <option value="4"></option>
          <option value="5"></option>
        </datalist>
      </div>
      <span class="fontsize large">A</span>
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'

const general_chatTheme = ref(null)
const general_fontSize = ref(null)

const load = () => {
  general_chatTheme.value = store.config.appearance.chat.theme || 'openai'
  general_fontSize.value = store.config.appearance.chat.fontSize || 3
}

const save = () => {
  store.config.appearance.chat.theme = general_chatTheme.value
  store.config.appearance.chat.fontSize = general_fontSize.value
  store.save()
}

defineExpose({
  load,
  save
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>
