<template>
  <ContextMenuPlus
    ref="contextMenuPlus"
    css-classes="experts-menu"
    :anchor="anchor"
    :position="position"
    :teleport="teleport"
    :show-filter="true"
    :hover-highlight="false"
    :items="menuItems"
    :footer-items="footerItems"
    @close="$emit('close')"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useExpertsMenu } from '../composables/useExpertsMenu'
import ContextMenuPlus from './ContextMenuPlus.vue'

// Props
interface Props {
  anchor: string
  position?: 'below' | 'above' | 'right' | 'left' | 'above-right' | 'above-left' | 'below-right' | 'below-left'
  teleport?: boolean
  footerMode?: 'manage' | 'clear' | 'none'
}

const props = withDefaults(defineProps<Props>(), {
  position: 'below',
  teleport: true,
  footerMode: 'none',
})

// Emits
interface Emits {
  close: []
  expertSelected: [expertId: string | null]
  manageExperts: []
}

const emit = defineEmits<Emits>()

// Reactive data
const contextMenuPlus = ref()

// Use experts menu composable
const { menuItems, footerItems } = useExpertsMenu({
  emit,
  footerMode: props.footerMode,
})

</script>

<style>
/* Add any experts-specific styles here if needed */
</style>
