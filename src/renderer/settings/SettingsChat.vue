<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.chat') }}</div>
    </header>
    <main class="form form-vertical form-large">
      <div class="form-field layout">
        <label>{{ t('settings.chat.listLayout') }}</label>
        <select v-model="layout" @change="save">
          <option value="normal">{{ t('settings.chat.listLayouts.cozy') }}</option>
          <option value="compact">{{ t('settings.chat.listLayouts.compact') }}</option>
        </select>
      </div>
      <div class="form-field theme">
        <label>{{ t('settings.chat.theme') }}</label>
        <select v-model="theme" @change="save">
          <option value="openai">{{ t('settings.chat.themes.openai') }}</option>
          <option value="conversation">{{ t('settings.chat.themes.conversation') }}</option>
        </select>
      </div>
      <div class="form-field send-key">
        <label>{{ t('settings.chat.sendKey.title') }}</label>
        <select v-model="sendKey" @change="save">
          <option value="enter">{{ t('settings.chat.sendKey.enter') }}</option>
          <option value="shiftEner">{{ t('settings.chat.sendKey.shiftEnter') }}</option>
        </select>
      </div>
      <div class="form-field previews">
        <label>{{ t('settings.chat.previews.title') }}</label>
      </div>
      <div class="form-field horizontal run-at-login">
        <input type="checkbox" id="preview-html" v-model="previewHtml" @change="save" />
        <label for="preview-html">{{ t('settings.chat.previews.html') }}</label>
      </div>
      <div class="form-field copy">
        <label>{{ t('settings.chat.copyFormat.title') }}</label>
        <select v-model="copyFormat" @change="save">
          <option value="text">{{ t('settings.chat.copyFormat.text') }}</option>
          <option value="markdown">{{ t('settings.chat.copyFormat.markdown') }}</option>
        </select>
        <div class="help">{{ t('settings.chat.copyFormat.help') }}</div>
      </div>
      <div class="form-field tools">
        <label>{{ t('settings.chat.showToolCalls.title') }}</label>
        <select v-model="showToolCalls" @change="save">
          <option value="never">{{ t('settings.chat.showToolCalls.never') }}</option>
          <option value="calling">{{ t('settings.chat.showToolCalls.calling') }}</option>
          <option value="always">{{ t('settings.chat.showToolCalls.always') }}</option>
        </select>
      </div>
      <div class="form-field font-family">
        <label>{{ t('settings.chat.font') }}</label>
        <select v-model="fontFamily" @change="save">
          <option value="">{{ t('common.default') }}</option>
          <option v-for="font in fonts" :value="font">{{ font.replaceAll('"', '') }}</option>
        </select>
      </div>
      <div class="form-field font-size">
        <label>{{ t('settings.chat.fontSize') }}</label>
        <div class="control-group">
          <span class="slider-label small">A</span>
          <div class="slider-group">
            <input type="range" min="1" max="5" v-model="fontSize" @input="save" />
            <datalist id="fontsize">
              <option value="1"></option>
              <option value="2"></option>
              <option value="3"></option>
              <option value="4"></option>
              <option value="5"></option>
            </datalist>
          </div>
          <span class="slider-label large">A</span>
        </div>
      </div>
      <div class="form-field example">
        <label>{{ t('settings.chat.fontExample.title') }}</label>
        <div class="sample messages" :class="[ chatTheme, 'size' + store.config.appearance.chat.fontSize ]" :style="fontStyle">
          <MessageItem
          :message="Message.fromJson({
            uuid: 'fontsize-example',
            type: 'text',
            role: 'assistant',
            content: t('settings.chat.fontExample.text'),
            engine: 'engine',
          })"
          :show-role="false"
          :show-actions="false"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">

import { ChatListLayout, ChatToolMode, SendKey, TextFormat } from 'types/config';
import { ref, computed, provide } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import Message from '@models/message'
import MessageItem from '@components/MessageItem.vue'

// provide null chat-callbacks for MessageItem (no actions available in settings preview)
provide('chat-callbacks', null)

const theme = ref(null)
const fontSize = ref(null)
const fontFamily = ref('')
const previewHtml = ref(true)
const copyFormat = ref<TextFormat>('text')
const sendKey = ref<SendKey>('enter')
const showToolCalls = ref<ChatToolMode>('calling')
const layout = ref<ChatListLayout>('normal')
const fonts = ref(window.api.app.listFonts())

const chatTheme = computed(() => store.config.appearance.chat.theme)
const fontStyle = computed(() => {
  return {
    '--font-family-base': store.config.appearance.chat.fontFamily,
  }
})

const load = () => {
  theme.value = store.config.appearance.chat.theme || 'openai'
  layout.value = store.config.appearance.chatList.layout || 'normal'
  copyFormat.value = store.config.appearance.chat.copyFormat || 'text'
  sendKey.value = store.config.appearance.chat.sendKey || 'enter'
  previewHtml.value = store.config.appearance.chat.autoPreview.html ?? true
  showToolCalls.value = store.config.appearance.chat.showToolCalls || 'calling'
  fontFamily.value = store.config.appearance.chat.fontFamily || ''
  fontSize.value = store.config.appearance.chat.fontSize || 3
}

const save = () => {
  store.config.appearance.chat.theme = theme.value
  store.config.appearance.chat.fontFamily = fontFamily.value
  store.config.appearance.chat.fontSize = fontSize.value
  store.config.appearance.chat.sendKey = sendKey.value
  store.config.appearance.chatList.layout = layout.value
  store.config.appearance.chat.autoPreview.html = previewHtml.value
  store.config.appearance.chat.showToolCalls = showToolCalls.value
  store.config.appearance.chat.copyFormat = copyFormat.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>

.slider-label.small {
  font-size: 10.5px;
}

.slider-label.large {
  font-size: 16px;
}

.sample {
  box-sizing: border-box;
  margin-top: 0.5rem;
  width: 100%;
  border: 1px solid var(--sidebar-border-color);
  padding: 1rem;
}

.messages * {
  margin: 0 !important;
  padding: 0 !important;
  width: 100%;
}

</style>