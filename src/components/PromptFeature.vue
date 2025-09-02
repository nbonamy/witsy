<template>
  <div class="prompt-feature" @click="onClear">
    <component :is="icon" class="icon" />
    <span class="label">{{ label }}</span>
    <XIcon class="clear" />
  </div>
</template>

<script setup lang="ts">

import { XIcon } from 'lucide-vue-next';

interface Props {
  icon?: any
  label: string
}

defineProps<Props>()

const emit = defineEmits<{
  clear: []
}>()

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
  margin-left: 0.5rem;
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

.prompt-feature .clear {
  width: 0.75rem;
  height: 0.75rem;
  cursor: pointer;
  color: var(--color-secondary);
}

</style>