<template>
  <div class="content">
    <div class="group appearance">
      <label>Appearance</label>
      <div @click="setAppearanceTheme('light')" :class="{ selected: appearance == 'light' }">
        <img src="/assets/appearance-light.png" />
        Light
      </div>
      <div @click="setAppearanceTheme('dark')" :class="{ selected: appearance == 'dark' }">
        <img src="/assets/appearance-dark.png" />
        Dark
      </div>
      <div @click="setAppearanceTheme('system')" :class="{ selected: appearance == 'system' }">
        <img src="/assets/appearance-system.png" />
        System
      </div>
    </div>
    <div class="group tint">
      <label>Dark tint</label>
      <select v-model="tint" @change="onTintChange">
        <option value="black">Black</option>
        <option value="blue">Blue</option>
      </select>
    </div>
    <div class="group theme">
      <label>Chat theme</label>
      <select v-model="theme" @change="save">
        <option value="openai">OpenAI</option>
        <option value="conversation">Conversation</option>
      </select>
    </div>
    <div class="group font-family">
      <label>Chat font</label>
      <select v-model="fontFamily" @change="save">
        <option value="">Default</option>
        <option v-for="font in fonts" :value="font">{{ font.replaceAll('"', '') }}</option>
      </select>
    </div>
    <div class="group font-size">
      <label>Chat font size</label>
      <span class="fontsize small">A</span>
      <div class="slidergroup">
        <input type="range" min="1" max="5" v-model="fontSize" @input="save" />
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

// events
import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const appearance = ref(null)
const tint = ref(null)
const theme = ref(null)
const fontSize = ref(null)
const fontFamily = ref('')
const fonts = ref(window.api.listFonts())

const load = () => {
  appearance.value = store.config.appearance.theme || 'system'
  tint.value = store.config.appearance.tint || 'black'
  theme.value = store.config.appearance.chat.theme || 'openai'
  fontFamily.value = store.config.appearance.chat.fontFamily || ''
  fontSize.value = store.config.appearance.chat.fontSize || 3
}

const setAppearanceTheme = (value) => {
  appearance.value = value
  window.api.setAppearanceTheme(value)
  save()
}

const onTintChange = () => {
  emitEvent('appearance-tint-changed', tint.value)
  save()
}

const save = () => {
  store.config.appearance.theme = appearance.value
  store.config.appearance.tint = tint.value
  store.config.appearance.chat.theme = theme.value
  store.config.appearance.chat.fontFamily = fontFamily.value
  store.config.appearance.chat.fontSize = fontSize.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>

<style scoped>

.appearance {
  padding-bottom: 8px;
  margin-top: 0px;
}

.appearance img {
  height: auto;
  width: 64px;
  object-fit: contain;
  padding: 1px;
  border: 3px solid transparent;
}

.appearance div {
  text-align: center;
}

.appearance div.selected img {
  border: 3px solid var(--highlight-color);
  border-radius: 8px;
}

.fontsize {
  display: inline-block;
  margin: 0 8px !important;
}

.fontsize.small {
  font-size: 8pt;
}

.fontsize.large {
  font-size: 12pt;
}

</style>