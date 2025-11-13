<template>
  <label class="button-switch" :class="{ disabled }">
    <input
      type="checkbox"
      :checked="isChecked"
      :disabled="disabled"
      @change="onChange"
      @click.stop
      class="switch-input"
    />
    <span class="switch-track">
      <span class="switch-thumb"></span>
    </span>
  </label>
</template>

<script setup lang="ts">

import { computed } from 'vue'

const props = defineProps<{
  modelValue?: boolean
  checked?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'change': [value: boolean]
}>()

// Support both v-model (modelValue) and checked prop
const isChecked = computed(() => {
  return props.checked ?? props.modelValue ?? false
})

const onChange = (event: Event) => {
  const target = event.target as HTMLInputElement

  // Emit both events - parent can choose which to use
  emit('update:modelValue', target.checked)
  emit('change', target.checked)
}

</script>

<style scoped>

.button-switch {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.button-switch.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.switch-input {
  display: none;
}

.switch-track {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 24px;
  background-color: var(--color-surface-high);
  border-radius: 12px;
  transition: background-color 0.2s ease;
}

.switch-input:checked + .switch-track {
  background-color: var(--color-primary);
}

.switch-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 16px;
  height: 16px;
  background-color: #FFFFFF;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.switch-input:checked + .switch-track .switch-thumb {
  transform: translateX(16px);
}

.switch-input:focus-visible + .switch-track {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.button-switch:not(.disabled):hover .switch-track {
  background-color: var(--color-surface-highest);
}

.button-switch:not(.disabled) .switch-input:checked:hover + .switch-track {
  background-color: #1558C7;
}

</style>
