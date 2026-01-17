<template>
  <div class="form form-vertical form-large">

    <div class="form-field">
      <label>{{ t('settings.voice.quickDictation.shortcutKey') }}</label>
      <InputShortcut v-model="shortcut" :accept-native="areNativeShortcutsSupported" @change="onChange" />
      <div class="help" v-html="nativeShortcutsHint" v-if="areNativeShortcutsSupported"></div>
      <div class="help warning" v-html="t('settings.voice.quickDictation.linuxPermissionWarning')" v-if="isLinux && areNativeShortcutsSupported"></div>
    </div>
    
    <div class="form-field" v-if="areNativeShortcutsSupported">
      <label>{{ t('settings.voice.quickDictation.activation') }}</label>
      <select name="activation" v-model="activation" @change="onChange">
        <option value="tap">{{ t('settings.voice.quickDictation.activationTap') }}</option>
        <option value="doubleTap">{{ t('settings.voice.quickDictation.activationDoubleTap') }}</option>
        <option value="hold">{{ t('settings.voice.quickDictation.activationHold') }}</option>
      </select>
      <div class="help" v-if="activation !== 'hold'" v-html="t('settings.voice.quickDictation.activationHelp')"></div>
    </div>

    <div class="form-field">
      <label>{{ t('settings.voice.quickDictation.appearance') }}</label>
      <select name="appearance" v-model="appearance" @change="save">
        <option value="bottom">{{ t('settings.voice.quickDictation.appearanceBottom') }}</option>
        <option value="top">{{ t('settings.voice.quickDictation.appearanceTop') }}</option>
        <option value="notch">{{ t('settings.voice.quickDictation.appearanceNotch') }}</option>
      </select>
    </div>

    <div class="form-field horizontal">
      <input type="checkbox" id="copy-to-clipboard" v-model="copyToClipboard" @change="save" />
      <label for="copy-to-clipboard" class="no-colon">{{ t('settings.voice.quickDictation.copyToClipboard') }}</label>
    </div>

  </div>
</template>

<script setup lang="ts">

import { computed, ref } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import { toElectronIfPossible, toNative } from '@renderer/utils/shortcut'
import { Shortcut } from 'types/index'
import { ShortcutActivation } from 'types/config'
import InputShortcut from '@components/InputShortcut.vue'

const shortcut = ref<Shortcut|undefined>(undefined)
const activation = ref<ShortcutActivation>('tap')
const appearance = ref<'bottom' | 'top' | 'notch'>('bottom')
const copyToClipboard = ref(false)

const areNativeShortcutsSupported = computed(() => window.api.shortcuts.areNativeShortcutsSupported())
const isLinux = computed(() => window.api.platform === 'linux')

const nativeShortcutsHint = computed(() => {
  const isMac = window.api.platform === 'darwin'
  if (isMac) {
    return t('settings.voice.quickDictation.nativeShortcutsHint', {
      single: 'Right ⌘, Right ⌥, Right ⇧, Right ⌃',
      combos: '⌥⌘, ⌃⌘, ⌃⌥, ⇧⌘, ⇧⌥, ⇧⌃'
    })
  } else {
    return t('settings.voice.quickDictation.nativeShortcutsHint', {
      single: 'Right Win, Right Alt, Right Shift, Right Ctrl',
      combos: 'Alt+Win, Ctrl+Win, Ctrl+Alt, Shift+Win, Shift+Alt, Shift+Ctrl'
    })
  }
})

const load = () => {
  shortcut.value = store.config.shortcuts.dictation
  activation.value = store.config.stt.quickDictation?.activation ?? 'tap'
  appearance.value = store.config.stt.quickDictation?.appearance ?? 'bottom'
  copyToClipboard.value = store.config.stt.quickDictation?.copyToClipboard ?? false
}

const onChange = () => {
  // Convert shortcut based on activation mode
  if (activation.value === 'tap') {
    // Tap mode: use electron if shortcut has a key, otherwise keep native
    shortcut.value = toElectronIfPossible(shortcut.value)
  } else {
    // DoubleTap/Hold modes: must use native shortcuts
    shortcut.value = toNative(shortcut.value)
  }
  save()
}

const save = () => {
  store.config.shortcuts.dictation = shortcut.value
  store.config.stt.quickDictation.activation = activation.value
  store.config.stt.quickDictation.appearance = appearance.value
  store.config.stt.quickDictation.copyToClipboard = copyToClipboard.value
  store.saveSettings()
  window.api.shortcuts.register()
}

defineExpose({ load })

</script>

<style scoped>
.help.warning {
  color: var(--color-warning);
  margin-top: 8px;
}

.help.warning :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
}
</style>
