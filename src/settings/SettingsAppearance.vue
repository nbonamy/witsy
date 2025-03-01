<template>
  <div class="content">
    <div class="group appearance">
      <label>{{ t('settings.appearance.theme') }}</label>
      <div @click="setAppearanceTheme('light')" :class="{ selected: appearance == 'light' }">
        <img src="/assets/appearance-light.png" />
        {{ t('settings.appearance.themes.light') }}
      </div>
      <div @click="setAppearanceTheme('dark')" :class="{ selected: appearance == 'dark' }">
        <img src="/assets/appearance-dark.png" />
        {{ t('settings.appearance.themes.dark') }}
      </div>
      <div @click="setAppearanceTheme('system')" :class="{ selected: appearance == 'system' }">
        <img src="/assets/appearance-system.png" />
        {{ t('settings.appearance.themes.system') }}
      </div>
    </div>
    <div class="group tint">
      <label>{{ t('settings.appearance.darkTint') }}</label>
      <select v-model="tint" @change="onTintChange">
        <option value="black">{{ t('settings.appearance.tints.black') }}</option>
        <option value="blue">{{ t('settings.appearance.tints.blue') }}</option>
      </select>
    </div>
    <div class="group theme">
      <label>{{ t('settings.appearance.chatTheme') }}</label>
      <select v-model="theme" @change="save">
        <option value="openai">{{ t('settings.appearance.chatThemes.openai') }}</option>
        <option value="conversation">{{ t('settings.appearance.chatThemes.conversation') }}</option>
      </select>
    </div>
    <div class="group layout">
      <label>{{ t('settings.appearance.chatListLayout') }}</label>
      <select v-model="layout" @change="save">
        <option value="normal">{{ t('settings.appearance.chatListLayouts.cozy') }}</option>
        <option value="compact">{{ t('settings.appearance.chatListLayouts.compact') }}</option>
      </select>
    </div>
    <div class="group font-family" v-if="!isMas">
      <label>{{ t('settings.appearance.chatFont') }}</label>
      <select v-model="fontFamily" @change="save">
        <option value="">{{ t('common.default') }}</option>
        <option v-for="font in fonts" :value="font">{{ font.replaceAll('"', '') }}</option>
      </select>
    </div>
    <div class="group font-size">
      <label>{{ t('settings.appearance.chatFontSize') }}</label>
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

<script setup lang="ts">

import { ChatListLayout } from '../types/config';
import { Ref, ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'

// events
import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const isMas = ref(false)
const appearance = ref(null)
const tint = ref(null)
const theme = ref(null)
const fontSize = ref(null)
const fontFamily = ref('')
const layout: Ref<ChatListLayout> = ref('normal')
const fonts = ref(window.api.listFonts())

const load = () => {
  isMas.value = window.api.isMasBuild
  appearance.value = store.config.appearance.theme || 'system'
  tint.value = store.config.appearance.tint || 'black'
  theme.value = store.config.appearance.chat.theme || 'openai'
  layout.value = store.config.appearance.chatList.layout || 'normal'
  fontFamily.value = store.config.appearance.chat.fontFamily || ''
  fontSize.value = store.config.appearance.chat.fontSize || 3
}

const setAppearanceTheme = (value: string) => {
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
  store.config.appearance.chatList.layout = layout.value
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