
<template>
  <button @click="onClick" :class="{ refreshing: refreshing }">
    <component :is="refreshIcon" />
  </button>
</template>

<script setup lang="ts">

import { CheckCheckIcon, CircleAlertIcon, RefreshCcwIcon } from 'lucide-vue-next'
import { PropType, ref } from 'vue'

const props = defineProps({
  onRefresh: {
    type: Function as PropType<() => Promise<boolean>>,
    required: true
  }
})

const refreshIcon = ref(RefreshCcwIcon)
const refreshing = ref(false)

const onClick = async () => {
  refreshing.value = true
  await new Promise(resolve => setTimeout(resolve, 500))
  const rc = await props.onRefresh.call(this)
  refreshIcon.value = rc ? CheckCheckIcon : CircleAlertIcon
  refreshing.value = false
  setTimeout(() => {
    refreshIcon.value = RefreshCcwIcon
  }, 2000)
}

defineExpose({
  refresh: onClick
})

</script>

<style scoped>

svg {
  width: 0.85rem;
  height: 0.85rem;
}

.refreshing {
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

.refreshing svg {
  animation: spin 1s linear infinite;
}
</style>