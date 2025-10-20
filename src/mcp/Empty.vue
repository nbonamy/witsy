<template>
  <div class="mcp-empty">
    <Plug2Icon class="icon" />
    <h3>{{ t('mcp.empty.title') }}</h3>
    <p>{{ t('mcp.empty.text') }}</p>
    <button class="cta" @click="emit('click')"><McpIcon /> {{ t('mcp.addCustomServer') }}</button>
  </div>
</template>

<script setup lang="ts">
import { Plug2Icon } from 'lucide-vue-next'
import McpIcon from '../../assets/mcp.svg?component'
import { t } from '../services/i18n'

const emit = defineEmits(['click'])

</script>

<style scoped>

.mcp-empty {
  
  flex: 1;
  display: flex;
  padding: 0% 20%;
  padding-bottom: 4.25rem;
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