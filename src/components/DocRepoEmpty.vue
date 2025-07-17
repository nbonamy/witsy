<template>
  <main class="empty">
    <div>
      {{ t('docRepo.repositories.noRepositories') }}<br />{{ t('docRepo.repositories.clickToCreate') }}
    </div>
  </main>
</template>

<script setup lang="ts">
import { t } from '../services/i18n'
</script>

<style scoped>
.empty {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 16px;
  font-size: 14pt;
  line-height: 1.5;
  text-align: center;
  opacity: 0.6;
}

* {
  color: var(--text-color);
}
</style>
