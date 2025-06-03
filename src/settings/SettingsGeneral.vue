<template>
  <form class="tab-content vertical large">
    <header>
      <div class="title">{{ t('settings.tabs.general') }}</div>
    </header>
    <main>
      <div class="group appearance">
        <label>{{ t('settings.general.theme') }}</label>
        <div class="subgroup">
          <div @click="setAppearanceTheme('light')" :class="{ selected: appearance == 'light' }">
            <img src="/assets/appearance-light.png" />
            {{ t('settings.general.themes.light') }}
          </div>
          <div @click="setAppearanceTheme('dark')" :class="{ selected: appearance == 'dark' }">
            <img src="/assets/appearance-dark.png" />
            {{ t('settings.general.themes.dark') }}
          </div>
          <div @click="setAppearanceTheme('system')" :class="{ selected: appearance == 'system' }">
            <img src="/assets/appearance-system.png" />
            {{ t('settings.general.themes.system') }}
          </div>
        </div>
      </div>
      <div class="group lightTint" v-if="appearanceTheme.getTheme() === 'light'">
        <label>{{ t('settings.general.lightTint') }}</label>
        <select v-model="lightTint" @change="onTintChange">
          <option value="white">{{ t('settings.general.tints.white') }}</option>
          <option value="gray">{{ t('settings.general.tints.gray') }}</option>
        </select>
      </div>
      <div class="group darkTint" v-if="appearanceTheme.getTheme() === 'dark'">
        <label>{{ t('settings.general.darkTint') }}</label>
        <select v-model="darkTint" @change="onTintChange">
          <option value="black">{{ t('settings.general.tints.black') }}</option>
          <option value="blue">{{ t('settings.general.tints.blue') }}</option>
        </select>
      </div>
      <div class="group localeUI">
        <label>{{ t('settings.general.localeUI') }}</label>
        <LangSelect v-model="localeUI" default-text="common.language.system" :filter="locales" @change="save" />
      </div>
      <div class="group reset-tips">
        <label>{{ t('settings.general.resetTips') }}</label>
        <button @click.prevent="onResetTips">{{ t('common.reset') }}</button>
      </div>
      <div class="group horizontal run-at-login">
        <input type="checkbox" v-model="runAtLogin" @change="save" />
        <label>{{ t('settings.general.runAtLogin') }}</label>
      </div>
      <div class="group horizontal hide-on-startup">
        <input type="checkbox" v-model="hideOnStartup" @change="save" />
        <label>{{ t('settings.general.hideOnStartup') }}</label>
      </div>
      <div class="group horizontal keep-running">
        <input type="checkbox" v-model="keepRunning" @change="save" />
        <label>{{ t('settings.general.keepInStatusBar') }}</label>
      </div>
    </main>
  </form>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import useAppearanceTheme from '../composables/appearance_theme'
import LangSelect from '../components/LangSelect.vue'

// events
import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

// init
const appearanceTheme = useAppearanceTheme()

const appearance = ref(null)
const darkTint = ref(null)
const lightTint = ref(null)
const locales = ref([])
const localeUI = ref(null)
const runAtLogin = ref(false)
const hideOnStartup = ref(false)
const keepRunning = ref(false)

const setAppearanceTheme = (value: string) => {
  appearance.value = value
  window.api.setAppearanceTheme(value)
  save()
}

const onTintChange = () => {
  save()
  emitEvent('appearance-tint-changed')
}

const load = () => {
  appearance.value = store.config.appearance.theme || 'system'
  lightTint.value = store.config.appearance.lightTint || 'white'
  darkTint.value = store.config.appearance.darkTint || 'black'
  locales.value = Object.keys(window.api.config.getI18nMessages())
  localeUI.value = store.config.general.locale
  runAtLogin.value = window.api.runAtLogin.get()
  hideOnStartup.value = store.config.general.hideOnStartup
  keepRunning.value = store.config.general.keepRunning
}

const onResetTips = () => {
  store.config.general.tips = {}
  store.saveSettings()
}

const save = () => {
  store.config.appearance.theme = appearance.value
  store.config.appearance.lightTint = lightTint.value
  store.config.appearance.darkTint = darkTint.value
  store.config.general.locale = localeUI.value
  window.api.runAtLogin.set(runAtLogin.value)
  store.config.general.hideOnStartup = hideOnStartup.value
  store.config.general.keepRunning = keepRunning.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style scoped>

dialog.settings .content {
  width: 480px;
}

form .group label {
  min-width: 170px;
}

.appearance {
  padding-bottom: 8px;
  margin-top: 0px;
}

.appearance .subgroup {
  margin-top: 1rem;
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 3rem;
}

.appearance .subgroup div {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
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

</style>