<template>
  <div class="context-menu" :style="{ top: y + 'px', left: x + 'px' }">
    <div v-for="action in actions" :key="action.action" :class="{ item: true, disabled: action.disabled }" @click="onAction(action)">
      {{ action.label }}
    </div>
  </div>
</template>

<script setup>
defineProps(['actions', 'x', 'y']);
const emit = defineEmits(['action-clicked']);

const onAction = (action) => {
  if (!action.disabled) {  
    emit('action-clicked', action.action)
  }
};

</script>

<style scoped>

.context-menu {
  -webkit-app-region: no-drag;
  position: absolute;
  background: rgba(229, 229, 229, 96%);
  border: 1px solid #B9B9B9;
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  z-index: 50;
  padding: 5px;
}

.context-menu .item {
  padding: 4px 12px;
  cursor: pointer;
  font-size: 10pt;
  white-space: nowrap;
}

.context-menu .item.disabled {
  color: gray;
}

.context-menu .item:not(.disabled):hover {
  background-color: #57A1FF;
  border-radius: 4px;
  color: white;
}

</style>