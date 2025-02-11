
<template>
  <select name="model" v-model="value" @change="$emit('change')" :disabled="disabled">
    <option value="" v-if="defaultText">{{ defaultText }}</option>
    <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
  </select>
</template>

<script setup lang="ts">

import { Model } from 'multi-llm-ts'
import { computed } from 'vue'
import { store } from '../services/store'
import LlmFactory from '../llms/llm'

const llmFactory = new LlmFactory(store.config)

const models = computed(() => llmFactory.getChatModels(props.engine))

const props = defineProps({
  engine: String,
  defaultText: String,
  disabled: {
    type: Boolean,
    default: false
  }
})

const value = defineModel()
const emit = defineEmits(['change']);

</script>
