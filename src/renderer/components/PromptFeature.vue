<template>
  <div class="prompt-feature" @click="onClear" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
    <component :is="icon" class="icon" v-if="!active"/>
    <XIcon class="icon clear" v-else />
    <span class="label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">

import { XIcon } from 'lucide-vue-next';
import { ref } from 'vue';

interface Props {
  icon?: any
  label: string
}

defineProps<Props>()

const emit = defineEmits<{
  clear: []
}>()

const active = ref(false)

const onMouseEnter = () => {
  active.value = true
}

const onMouseLeave = () => {
  active.value = false
}

const onClear = () => {
  emit('clear')
}

</script>

<style scoped>

.prompt-feature {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--highlight-color);
  padding: 0.25rem;

  &:hover {
    cursor: pointer;
    border-radius: 4px;
    background-color: var(--color-secondary-container);
  }
}

.prompt-feature .icon {
  width: var(--icon-md);
  height: var(--icon-md);
  color: var(--color-secondary);
}

.prompt-feature .label {
  max-width: 128px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14.5px;
  color: var(--color-secondary);
}

</style>