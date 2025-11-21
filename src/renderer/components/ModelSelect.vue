
<template>
  <select name="model" v-model="value" @change="$emit('change')" :disabled="disabled">
    <option value="" v-if="defaultText">{{ defaultText }}</option>
    <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
  </select>
</template>

<script setup lang="ts">

import { ChatModel } from 'multi-llm-ts'
import { computed, ComputedRef } from 'vue'
import { store } from '@services/store'
import LlmFactory, { ILlmManager } from '@services/llms/llm'

const llmManager: ILlmManager = LlmFactory.manager(store.config)

const models: ComputedRef<any[]> = computed(() => {
  return props.models ?? llmManager.getChatModels(props.engine)
})

const props = defineProps({
  engine: String,
  models: Array<ChatModel>,
  defaultText: String,
  disabled: {
    type: Boolean,
    default: false
  }
})

const value = defineModel()
const emit = defineEmits(['change']);

</script>

