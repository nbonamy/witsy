<template>
  <div class="wait">
    <Loader />
    <BIconXCircleFill class="cancel" @click="onCancel" />
    Thinking…
  </div>
</template>

<script setup>

import Loader from '../components/Loader.vue'

const onCancel = () => {
  window.api.commands.cancel()
}

</script>

<style scoped>

::-webkit-scrollbar {
  display: none;
}

.wait {
  box-sizing: border-box;
  height: 100vh;
  background-color: #e7e6e5;
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
  display: none;
}

.wait:hover .cancel {
  display: inline-block;
}

.wait:hover .loader {
  display: none;
}

</style>