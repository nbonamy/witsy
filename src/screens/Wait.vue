<template>
  <div class="wait">
    <Loader /> Thinking...
  </div>
</template>

<script setup>

import Loader from '../components/Loader.vue'

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


</style>