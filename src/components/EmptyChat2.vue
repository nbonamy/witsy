<template>
  <div class="empty">
    <h1>{{ t('chat.empty.greeting') }}</h1>
    <div class="shortcuts">

      <div v-for="shortcut in shortcuts" :key="shortcut.name" class="shortcut" @click="shortcut.run">
        <AgentIcon class="icon" />
        <h2>{{ shortcut.name }}</h2>
        <p>{{ shortcut.description }}</p>
      </div>

      <div v-if="shortcuts.length === 0">
        <p>No shortcuts available</p>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue';
import { t } from '../services/i18n'
import { store } from '../services/store'
import AgentIcon from '../../assets/agent.svg?component'

type Shortcut = {
  name: string
  description: string
  run: () => void
}

const emit = defineEmits(['run-agent'])

const shortcuts = computed((): Shortcut[] => {

  return store.agents.map((a) => ({
    name: a.name,
    description: a.description,
    run: () => {
      emit('run-agent', a.uuid)
    }
  }))

});

</script>


<style scoped>

.empty {

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3rem;

  h1 {
    font-size: 24px;
    font-weight: var(--font-weight-semibold);
    color: var(--color-on-surface);
  }

  .shortcuts {

    display: flex;
    flex-direction: row;
    gap: 1rem;

    .shortcut {
      border-radius: 8px;
      border: 0 solid var(--color-light-outline-subtle, rgba(217, 217, 221, 0.70));
      background: var(--color-light-surface-container-lowest, #FFF);
      box-shadow: 0 4px 10px -2px rgba(0, 0, 0, 0.06);

      display: flex;
      width: 184px;
      min-width: 140px;
      padding: 16px 16px 24px 16px;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;

      cursor: pointer;

      .icon {
        width: 1.25rem;
        height: 1.25rem;
        aspect-ratio: 1/1;
        color: var(--color-tertiary);
        margin-bottom: 0.5rem;
      }

      h2 {
        margin: 0;
        color: var(--color-light-on-surface, #27272A);
        font-family: Inter;
        font-size: 16px;
        font-style: normal;
        font-weight: 500;
        line-height: 20px;
      }

      p {
        margin: 0;
        color: var(--color-light-on-surface-variant, #71717A);
        font-family: Inter;
        font-size: 13px;
        font-style: normal;
        font-weight: 400;
        line-height: 16px;
      }
    }


  }
}

</style>
