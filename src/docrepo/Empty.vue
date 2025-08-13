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
  padding: 30% 20%;
  
  .empty-content {
    text-align: center;
    
    .empty-icon {
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
}
</style>