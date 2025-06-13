
<template>
  <select name="engine" v-model="value" @change="$emit('change')" :disabled="disabled">
    <option value="" v-if="defaultText">{{ defaultText }}</option>
    <option :value="favoriteMockEngine" v-if="showFavorites">Favorite models</option>
    <option value="openai">OpenAI</option>
    <option value="anthropic">Anthropic</option>
    <option value="google">Google</option>
    <option value="xai">xAI</option>
    <option value="meta">Meta</option>
    <option value="ollama">Ollama</option>
    <option value="lmstudio">LM Studio</option>
    <option value="mistralai">MistralAI</option>
    <option value="deepseek">DeepSeek</option>
    <option value="openrouter">OpenRouter</option>
    <option value="groq">Groq</option>
    <option value="cerebras">Cerebras</option>
    <option v-for="c in custom" :key="c.id" :value="c.id">{{ c.label }}</option>
  </select>
</template>

<script setup lang="ts">

import { CustomEngineConfig } from '../types/config'
import { computed } from 'vue'
import { store } from '../services/store'
import LlmFactory, { favoriteMockEngine } from '../llms/llm'

const llmManager = LlmFactory.manager(store.config)

const props = defineProps({
  defaultText: String,
  favorites: Boolean,
  disabled: {
    type: Boolean,
    default: false
  }
})

const value = defineModel()
const emit = defineEmits(['change'])

const showFavorites = computed(() => {
  return props.favorites && llmManager?.getChatModels(favoriteMockEngine)?.length > 0
})

const custom = computed(() => {
  const customs = llmManager.getCustomEngines()
  return customs.map((id) => ({
    id: id,
    label: (store.config.engines[id] as CustomEngineConfig).label
  }))
})

</script>
