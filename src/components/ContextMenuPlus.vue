<template>
  <div v-if="visible" class="context-menu-plus" :style="{ left: x + 'px', top: y + 'px' }" @click.stop>
    <div 
      v-for="item in items" 
      :key="item.id" 
      class="menu-item" 
      @click="handleItemClick(item)"
    >
      {{ item.label }}
    </div>
  </div>
  <div v-if="visible" class="context-menu-overlay" @click="$emit('close')"></div>
</template>

<script setup lang="ts">
export interface MenuPlusItem {
  id: string
  label: string
}

defineProps<{
  visible: boolean
  x: number
  y: number
  items: MenuPlusItem[]
}>()

const emit = defineEmits<{
  close: []
  itemSelected: [item: MenuPlusItem]
}>()

const handleItemClick = (item: MenuPlusItem) => {
  emit('itemSelected', item)
  emit('close')
}
</script>

<style scoped>
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 998;
}

.context-menu-plus {
  position: fixed;
  background: var(--dropdown-background-color);
  border: 1px solid var(--dropdown-border-color);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 999;
  min-width: 120px;
  overflow: hidden;
}

.menu-item {
  padding: 8px 12px;
  cursor: pointer;
  color: var(--dropdown-text-color);
  font-size: 13px;
  transition: background-color 0.1s ease;
}

.menu-item:hover {
  background: var(--dropdown-item-hover-background-color);
}

.menu-item:active {
  background: var(--dropdown-item-active-background-color);
}
</style>
