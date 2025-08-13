<template>
  <div class="docrepo-empty">
    <BIconLightbulb class="icon" />
    <h3>{{ t('docRepo.empty.title') }}</h3>
    <p>{{ t('docRepo.empty.text') }}</p>
    <button class="cta with-icon" @click="$emit('click')"><BIconPlusLg /> {{ t('docRepo.empty.create') }}</button>
  </div>
</template>

<script setup lang="ts">
import { BIconLightbulb } from 'bootstrap-icons-vue';
import { t } from '../services/i18n'
</script>

<style scoped>
.docrepo-empty {
  
  flex: 1;
  padding: 0rem 20%;
  padding-bottom: 20%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  text-align: center;
      
  .icon {
    font-size: 7rem;
    margin-bottom: 3rem;
    fill: #1B4FB2;
  }
  
  h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }
  
  p {
    margin: 0;
    color: var(--faded-text-color);
    line-height: 1.5;
  }

}

</style>