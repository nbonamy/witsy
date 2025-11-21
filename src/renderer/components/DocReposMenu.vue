<template>
  <ContextMenuPlus
    ref="contextMenuPlus"
    css-classes="docrepos-menu"
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
import { useDocReposMenu } from '@composables/useDocReposMenu'
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
  docRepoSelected: [docRepoUuid: string]
  manageDocRepo: []
}

const emit = defineEmits<Emits>()

// Reactive data
const contextMenuPlus = ref()

// Use docrepos menu composable
const { menuItems, footerItems } = useDocReposMenu({
  emit,
  footerMode: props.footerMode,
})

</script>

<style>
/* Add any docrepos-specific styles here if needed */
</style>
