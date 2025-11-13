<template>
  <component :is="iconComponent" :class="{ spinning }" :style="sizeStyle" />
</template>

<script setup lang="ts">

import { RefreshCcwIcon } from 'lucide-vue-next'
import { computed, PropType } from 'vue'

const props = defineProps({
  icon: {
    type: [Object, Function] as PropType<any>,
    default: () => RefreshCcwIcon
  },
  spinning: {
    type: Boolean,
    default: false
  },
  size: {
    type: String as PropType<'sm' | 'md' | 'lg' | 'xl'>,
    default: undefined
  }
})

const iconComponent = computed(() => props.icon || RefreshCcwIcon)

const sizeMap = {
  sm: '0.85rem',
  md: 'var(--icon-md)',
  lg: 'var(--icon-lg)',
  xl: 'var(--icon-xl)'
}

const sizeStyle = computed(() => {
  if (!props.size) return {}
  return {
    width: sizeMap[props.size],
    height: sizeMap[props.size]
  }
})

</script>

<style scoped>

.spinning {
  animation: spin 1s linear infinite;
  pointer-events: none;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

</style>
