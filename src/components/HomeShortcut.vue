<template>
  <div class="shortcut" @click="onClick">
    <AgentIcon class="icon" />
    <div class="info">
      <h2>{{ name }}</h2>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentIcon from '../../assets/agent.svg?component'
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  description: { type: String, required: true },
})

const emit = defineEmits(['run'])

function onClick() {
  emit('run')
}
</script>

<style scoped>

.shortcut {
  
  width: 100%;
  box-sizing: border-box;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  display: flex;
  padding: 1rem 0.75rem;
  flex-direction: row;
  align-items: center;
  gap: 1rem;
  cursor: pointer;

  .icon {
    width: 1.5rem;
    height: 1.5rem;
    aspect-ratio: 1/1;
    flex-shrink: 0;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    flex: 1;

    h2 {
      margin: 0;
      color: var(--color-light-on-surface, #27272A);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 500;
      line-height: 20px;
    }

    p {
      margin: 0;
      color: var(--color-light-on-surface-variant, #71717A);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: 16px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

  }

}

</style>
