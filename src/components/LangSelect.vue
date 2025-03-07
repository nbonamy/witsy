
<template>
  <select name="locale" v-model="locale" @change="emit('change')">
    <option value="">{{ $t(defaultText) }}</option>
    <option v-for="language in languages" :key="language.locale" :value="language.locale">
      {{ language.label }}
    </option>
    <option v-for="language in extraLanguages" :key="language.locale" :value="language.locale">
      {{ language.label }}
    </option>
  </select>
</template>

<script setup lang="ts">

import { computed } from 'vue'

const allLanguages = [
  { locale: 'en-US', label: '🇬🇧 English' },
  { locale: 'fr-FR', label: '🇫🇷 Français' },
  { locale: 'es-ES', label: '🇪🇸 Español' },
  { locale: 'de-DE', label: '🇩🇪 Deutsch' },
  { locale: 'it-IT', label: '🇮🇹 Italiano' },
  { locale: 'pt-PT', label: '🇵🇹 Português' },
  { locale: 'nl-NL', label: '🇳🇱 Nederlands' },
  { locale: 'pl-PL', label: '🇵🇱 Polski' },
  { locale: 'ru-RU', label: '🇷🇺 Русский' },
  { locale: 'ja-JP', label: '🇯🇵 日本語' },
  { locale: 'ko-KR', label: '🇰🇷 한국어' },
  { locale: 'zh-CN', label: '🇨🇳 中文' },
  { locale: 'vi-VN', label: '🇻🇳 Tiếng Việt' },
  { locale: 'th-TH', label: '🇹🇭 ไทย' },
  { locale: 'id-ID', label: '🇮🇩 Bahasa Indonesia' },
  { locale: 'hi-IN', label: '🇮🇳 हिन्दी' },
  { locale: 'ar-SA', label: '🇸🇦 العربية' },
  { locale: 'tr-TR', label: '🇹🇷 Türkçe' },
  { locale: 'ms-MY', label: '🇲🇾 Bahasa Melayu' },
  { locale: 'sw-KE', label: '🇰🇪 Kiswahili' },
]

const locale = defineModel()

const props = defineProps({
  defaultText: {
    type: String,
    default: 'common.language.auto'
  },
  filter: {
    type: Array<string>,
    default: []
  }
})

const isVisible = (locale: string): boolean => {
  try {
    if (props.filter.length == 0) return true
    return props.filter.includes(locale.substring(0, 2))
  } catch (e) {
    return true
  }
}

const languages = computed(() => allLanguages.filter(language => isVisible(language.locale)))

const extraLanguages = computed(() => {
  return props.filter.filter(locale => !allLanguages.map(language => language.locale.substring(0, 2)).includes(locale))
    .map(locale => ({ locale, label: locale }))
})

const emit = defineEmits(['change']);

</script>

<style scoped>
@import '../../css/form.css';
</style>
