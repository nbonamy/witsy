
<template>
  <select v-model="language" @change="emit('change')">
    <option value="">🤖 Let LLM decide</option>
    <option value="en">🇬🇧 English</option>
    <option value="es">🇪🇸 Spanish</option>
    <option value="fr">🇫🇷 French</option>
    <option value="de">🇩🇪 German</option>
    <option value="it">🇮🇹 Italian</option>
    <option value="pt">🇵🇹 Portuguese</option>
    <option value="nl">🇳🇱 Dutch</option>
    <option value="pl">🇵🇱 Polish</option>
    <option value="ru">🇷🇺 Russian</option>
    <option value="ja">🇯🇵 Japanese</option>
    <option value="ko">🇰🇷 Korean</option>
    <option value="zh">🇨🇳 Chinese</option>
    <option value="vi">🇻🇳 Vietnamese</option>
    <option value="th">🇹🇭 Thai</option>
    <option value="id">🇮🇩 Indonesian</option>
    <option value="hi">🇮🇳 Hindi</option>
    <option value="ar">🇸🇦 Arabic</option>
    <option value="tr">🇹🇷 Turkish</option>
    <option value="ms">🇲🇾 Malay</option>
    <option value="fil">🇵🇭 Filipino</option>
    <option value="sw">🇰🇪 Swahili</option>
  </select>
</template>

<script setup>

const language = defineModel()

const emit = defineEmits(['change']);

</script>

<style scoped>
@import '../../css/form.css';
</style>
