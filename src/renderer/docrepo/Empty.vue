<template>
  <div class="docrepo-empty">
    <LightbulbIcon class="icon" />
    <h3>{{ t('docRepo.empty.title') }}</h3>
    <p>{{ t('docRepo.empty.text') }}</p>
    <button class="cta" @click="emit('click')"><PlusIcon /> {{ t('docRepo.empty.create') }}</button>
  </div>
</template>

<script setup lang="ts">
import { LightbulbIcon, PlusIcon } from 'lucide-vue-next';
import { t } from '@services/i18n';

const emit = defineEmits(['click'])

</script>

<style scoped>

.docrepo-empty {
  
  flex: 1;
  padding: 0rem 20%;
  display: flex;
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

}

</style>