<template>
  <div class="wait" @mouseenter="hover=true" @mouseleave="hover=false">
    <Loader v-show="!hover"/>
    <BIconXCircleFill v-show="hover" class="cancel" @click="onCancel" />
    Thinking…
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import Loader from '../components/Loader.vue'

const hover = ref(false)

const onCancel = () => {
  window.api.commands.cancel()
  window.api.anywhere.close()
}

</script>

<style scoped>

::-webkit-scrollbar {
  display: none;
}

.wait {
  box-sizing: border-box;
  height: 100vh;
  background-color: var(--window-bg-color);
  color: var(--text-color);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2px 8px;
  font-size: 9pt;
}

.loader {
  margin: 4px;
  width: 6px;
  height: 6px;
  display: inline-block;
}

.cancel {
  margin: 4px;
  width: 10px;
  height: 10px;
  display: inline-block;
}

</style>