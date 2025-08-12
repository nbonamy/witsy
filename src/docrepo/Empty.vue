<template>
  <div class="empty-state">
    <div class="empty-content">
      <BIconLightbulb class="empty-icon" />
      <h3>{{ t('docRepo.empty.title') }}</h3>
      <p>{{ t('docRepo.empty.text') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BIconLightbulb } from 'bootstrap-icons-vue';
import { t } from '../services/i18n'
</script>

<style scoped>
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  
  .empty-content {
    text-align: center;
    opacity: 0.6;
    
    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    
    h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }
    
    p {
      margin: 0;
      opacity: 0.8;
    }
  }
}
</style>