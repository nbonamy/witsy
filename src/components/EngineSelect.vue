
<template>
  <select v-model="value" @change="$emit('change')">
    <option value="" v-if="defaultText">{{ defaultText }}</option>
    <option value="openai">OpenAI</option>
    <option value="ollama">Ollama</option>
    <option value="anthropic">Anthropic</option>
    <option value="mistralai">MistralAI</option>
    <option value="google">Google</option>
    <option value="groq">Groq</option>
    <option value="cerebras">Cerebras</option>
  </select>
</template>

<script setup>

defineProps({
  defaultText: String
})

const value = defineModel()
const emit = defineEmits(['change']);
</script>
