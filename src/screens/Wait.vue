<template>
  <div class="wait">
    <Loader /> Thinking...
  </div>
</template>

<script setup>

import Loader from '../components/Loader.vue'

</script>

<style scoped>

.wait {
  height: 100vh;
  background-color: #e7e6e5;
  text-align: center;
  padding: 2px 8px;
  font-size: 9pt;
}

.loader {
  margin: 1px;
  width: 6px;
  height: 6px;
  display: inline-block;
}


</style>