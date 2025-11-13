<template>
  <div class="loader" :style="{ animationDelay: randomDelay + 's' }"></div>
</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'

const randomDelay = ref(0)

onMounted(() => {
  randomDelay.value = Math.random() / 3;
})

</script>

<style scoped>

.loader {
  display: inline-block;
  margin: 16px 0px;
  width: 8px;
  height: 8px;
  background-color: var(--text-color);
  border-radius: 50%;
  animation: glow 1s infinite;
}

@keyframes glow {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.5); }
}

</style>
