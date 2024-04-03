<template>
  <div class="context-menu" :style="{ top: y + 'px', left: x + 'px' }">
    <div v-for="action in actions" :key="action.action" @click="emitAction(action.action)">
      {{ action.label }}
    </div>
  </div>
</template>

<script setup>
defineProps(['actions', 'x', 'y']);
const emit = defineEmits(['action-clicked']);
const emitAction = (action) => {
  emit('action-clicked', action);
};
</script>

<style scoped>

.context-menu {
  position: absolute;
  background: rgba(229, 229, 229, 95%);
  border: 1px solid #aeaeae;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  min-width: 150px;
  z-index: 50;
}

.context-menu div {
  padding: 10px;
  cursor: pointer;
  font-size: 10pt;
}

.context-menu div:hover {
  background-color: #4a99fe;
  color: white;
}

</style>