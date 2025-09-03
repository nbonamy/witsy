
<template>
  <button @click="onClick" :class="{ refreshing: refreshing }">
    <component :is="refreshIcon" />
  </button>
</template>

<script setup lang="ts">

import { PropType, ref } from 'vue'

const props = defineProps({
  onRefresh: {
    type: Function as PropType<() => Promise<boolean>>,
    required: true
  }
})

const refreshIcon = ref('BIconArrowClockwise')
const refreshing = ref(false)

const onClick = async () => {
  refreshing.value = true
  await new Promise(resolve => setTimeout(resolve, 500))
  const rc = await props.onRefresh.call(this)
  refreshIcon.value = rc ? 'BIconCheckAll' : 'BIconExclamationLg'
  refreshing.value = false
  setTimeout(() => {
    refreshIcon.value = 'BIconArrowClockwise'
  }, 2000)
}

defineExpose({
  refresh: onClick
})

</script>

<style scoped>

button {
  padding-bottom: 2px !important;
}

.form.form-large button {
  padding-top: 6px !important;
  padding-bottom: 2px !important;
}

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