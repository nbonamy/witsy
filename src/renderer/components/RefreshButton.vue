
<template>
  <button @click="onClick" v-bind="$attrs">
    <SpinningIcon :icon="refreshIcon" :spinning="refreshing" size="sm" />
  </button>
</template>

<script setup lang="ts">

import { CheckCheckIcon, CircleAlertIcon, RefreshCcwIcon } from 'lucide-vue-next'
import { PropType, ref } from 'vue'
import SpinningIcon from './SpinningIcon.vue'

const props = defineProps({
  onRefresh: {
    type: Function as PropType<() => Promise<boolean>>,
    required: true
  }
})

const refreshIcon = ref(RefreshCcwIcon)
const refreshing = ref(false)

const onClick = async () => {
  if (refreshing.value) return
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
</style>