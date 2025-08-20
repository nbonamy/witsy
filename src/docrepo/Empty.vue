<template>
  <div class="docrepo-empty">
    <div class="close" @click.stop="emit('close')"><XIcon /></div>
    <LightbulbIcon class="icon" />
    <h3>{{ t('docRepo.empty.title') }}</h3>
    <p>{{ t('docRepo.empty.text') }}</p>
    <button class="cta" @click="emit('click')"><PlusIcon /> {{ t('docRepo.empty.create') }}</button>
  </div>
</template>

<script setup lang="ts">
import { LightbulbIcon, PlusIcon, XIcon } from 'lucide-vue-next';
import { t } from '../services/i18n';

const emit = defineEmits(['click', 'close'])

</script>

<style scoped>

.close {
  position: absolute;
  top: 2rem;
  right: 2rem;
  font-size: 18.5px;
  cursor: pointer;
}

.docrepo-empty {
  
  flex: 1;
  padding: 0rem 20%;
  border-top: 1px solid var(--sidebar-border-color);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
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