<template>
  <button class="button-icon" @click="onClick">
    <slot />
  </button>
</template>

<script setup lang="ts">

const emit = defineEmits(['click'])

function onClick() {
  emit('click')
}

</script>

<style scoped>

.button-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  margin: 0;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.15s ease;

  :deep(*) svg {
    color: var(--color-on-surface);
    width: var(--icon-md);
    height: var(--icon-md);
  }

  &:hover {
    background-color: var(--color-surface-low);
  }

  &:active {
    background-color: var(--color-surface-high);
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
}

</style>
