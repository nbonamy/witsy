
<template>
  <select name="language" v-model="language" @change="emit('change')">
    <option value="">{{ $t(defaultText) }}</option>
      <option value="en">🇬🇧 English</option>
      <option value="fr">🇫🇷 Français</option>
      <option value="es">🇪🇸 Español</option>
      <option value="de">🇩🇪 Deutsch</option>
      <option value="it">🇮🇹 Italiano</option>
      <option value="pt">🇵🇹 Português</option>
      <option value="nl">🇳🇱 Nederlands</option>
      <option value="pl">🇵🇱 Polski</option>
      <option value="ru">🇷🇺 Русский</option>
      <option value="ja">🇯🇵 日本語</option>
      <option value="ko">🇰🇷 한국어</option>
      <option value="zh">🇨🇳 中文</option>
      <option value="vi">🇻🇳 Tiếng Việt</option>
      <option value="th">🇹🇭 ไทย</option>
      <option value="id">🇮🇩 Bahasa Indonesia</option>
      <option value="hi">🇮🇳 हिन्दी</option>
      <option value="ar">🇸🇦 العربية</option>
      <option value="tr">🇹🇷 Türkçe</option>
      <option value="ms">🇲🇾 Bahasa Melayu</option>
      <option value="fil">🇵🇭 Filipino</option>
      <option value="sw">🇰🇪 Kiswahili</option>
  </select>
</template>

<script setup lang="ts">

const language = defineModel()

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
