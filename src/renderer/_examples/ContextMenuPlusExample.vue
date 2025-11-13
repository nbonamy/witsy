<template>
  <div class="example">
    <button id="menu-trigger" @click="showMenu = !showMenu">
      Right Click Me or Click to Show Context Menu (with v-for example)
    </button>
    
    <ContextMenuPlusTestMenu 
      v-if="showMenu" 
      anchor="#menu-trigger" 
      position="below"
      @close="showMenu = false"
    />
  </div>
</template>


<script setup lang="ts">
import { ref } from 'vue'
import ContextMenuPlusTestMenu from './ContextMenuPlusTestMenu.vue'

const showMenu = ref(false)

</script>

<style scoped>
.example {
  padding: 50px;
}

button {
  padding: 10px 20px;
  cursor: pointer;
}
</style>