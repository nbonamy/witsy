<template>
  <div class="agent-empty">
    <AgentIcon class="icon" />
    <h3>{{ t('agent.forge.empty.title') }}</h3>
    <p>{{ t('agent.forge.empty.text') }}</p>
    <button class="cta" @click="emit('click')"><PlusIcon /> {{ t('agent.forge.create') }}</button>
  </div>
</template>

<script setup lang="ts">
import { PlusIcon } from 'lucide-vue-next'
import AgentIcon from '../../../assets/agent.svg?component'
import { t } from '../services/i18n'

const emit = defineEmits(['click'])

</script>

<style scoped>

.agent-empty {

  flex: 1;
  display: flex;
  padding: 0% 20%;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  text-align: center;

  .icon {
    margin-bottom: 3rem;
    width: 7rem;
    height: 7rem;
    color: #1B4FB2;
  }

  h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: var(--font-weight-semibold);
  }

  p {
    margin: 0;
    color: var(--faded-text-color);
    line-height: 1.5;
  }

  button {
    padding: 1rem 1.5rem;
    border-radius: var(--radius-md);
  }

}

</style>
