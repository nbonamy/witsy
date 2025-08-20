<template>
  <div class="prompt-feature">
    <component :is="icon" class="icon" />
    <span class="label">{{ label }}</span>
    <XIcon class="clear" @click="onClear" />
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
}

.prompt-feature .icon {
  width: 1rem;
  height: 1rem;
  color: #0C72EE;
}

.prompt-feature .label {
  max-width: 128px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14.5px;
  color: #0C72EE;
}

.prompt-feature .clear {
  width: 0.75rem;
  height: 0.75rem;
  cursor: pointer;
  color: #0C72EE;
}

</style>