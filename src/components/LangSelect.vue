
<template>
  <select name="locale" v-model="locale" @change="emit('change')">
    <option value="">{{ $t(defaultText) }}</option>
    <option value="en-US">🇬🇧 English</option>
    <option value="fr-FR">🇫🇷 Français</option>
    <option value="es-ES">🇪🇸 Español</option>
    <option value="de-DE">🇩🇪 Deutsch</option>
    <option value="it-IT">🇮🇹 Italiano</option>
    <option value="pt-PT">🇵🇹 Português</option>
    <option value="nl-NL">🇳🇱 Nederlands</option>
    <option value="pl-PL">🇵🇱 Polski</option>
    <option value="ru-RU">🇷🇺 Русский</option>
    <option value="ja-JP">🇯🇵 日本語</option>
    <option value="ko-KR">🇰🇷 한국어</option>
    <option value="zh-CN">🇨🇳 中文</option>
    <option value="vi-VN">🇻🇳 Tiếng Việt</option>
    <option value="th-TH">🇹🇭 ไทย</option>
    <option value="id-ID">🇮🇩 Bahasa Indonesia</option>
    <option value="hi-IN">🇮🇳 हिन्दी</option>
    <option value="ar-SA">🇸🇦 العربية</option>
    <option value="tr-TR">🇹🇷 Türkçe</option>
    <option value="ms-MY">🇲🇾 Bahasa Melayu</option>
    <option value="sw-KE">🇰🇪 Kiswahili</option>
  </select>
</template>

<script setup lang="ts">

const locale = defineModel()

defineProps({
  defaultText: {
    type: String,
    default: 'common.language.auto'
  }
})

const emit = defineEmits(['change']);

</script>

<style scoped>
@import '../../css/form.css';
</style>
