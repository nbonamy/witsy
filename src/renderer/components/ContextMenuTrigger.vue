<template>
  <div class="context-menu-trigger">
    
    <ButtonIcon
      :id="triggerId" 
      class="trigger" 
      @click="toggleMenu"
      @keydown.enter="toggleMenu"
      @keydown.space.prevent="toggleMenu"
      tabindex="0"
    >
      <slot name="trigger">
        <MoreVerticalIcon />
      </slot>
    </ButtonIcon>
    
    <ContextMenuPlus
      v-if="isMenuOpen"
      :anchor="`#${triggerId}`"
      :position="position"
      :auto-close="true"
      @close="closeMenu"
    >
      <slot name="menu" />
    </ContextMenuPlus>
  
  </div>
</template>

<script setup lang="ts">

import { MoreVerticalIcon } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import useEventListener from '@composables/event_listener'
import ButtonIcon from './ButtonIcon.vue'
import ContextMenuPlus, { type MenuPosition } from './ContextMenuPlus.vue'

const { onDomEvent } = useEventListener()

const props = defineProps({
  position: {
    type: String as () => MenuPosition,
    default: 'below-right' as MenuPosition
  }
})

const isMenuOpen = ref(false)
const triggerId = ref('')

onMounted(() => {
  triggerId.value = `context-trigger-${Math.random().toString(36).substr(2, 9)}`
})

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isMenuOpen.value) {
    closeMenu()
  }
}

onMounted(() => {
  onDomEvent(document, 'keydown', handleEscape)
})

onBeforeUnmount(() => {
  // DOM listeners cleaned up by composable
})

defineExpose({
  closeMenu,
  toggleMenu,
  isMenuOpen: () => isMenuOpen.value
})

</script>

<style scoped>

.context-menu-trigger {
  position: relative;
  display: inline-block;
}

</style>