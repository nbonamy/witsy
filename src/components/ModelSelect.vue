
<template>
  <select v-model="value" @change="$emit('change')">
    <option value="" v-if="defaultText">{{ defaultText }}</option>
    <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
  </select>
</template>

<script setup lang="ts">

import { ref, onMounted, watch } from 'vue'
import { store } from '../services/store'

const models = ref([])

const props = defineProps({
  engine: String,
  defaultText: String
})

const value = defineModel()
const emit = defineEmits(['change']);

onMounted(() => {
  watch(() => props.engine || {}, loadModels, { immediate: true })
})

const loadModels = () => {
  if (!props.engine || props.engine == '') models.value = []
  models.value = store.config?.engines?.[props.engine]?.models?.chat
}

</script>
