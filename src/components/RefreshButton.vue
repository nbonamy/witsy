
<template>
  <button @click="onClick">{{ refreshLabel }}</button>
</template>

<script setup lang="ts">

import { PropType, ref } from 'vue'
import { t } from '../services/i18n'

const props = defineProps({
  onRefresh: {
    type: Function as PropType<() => Promise<boolean>>,
    required: true
  }
})

const refreshLabel = ref(t('common.refresh'))

const onClick = async () => {
  refreshLabel.value = t('common.refreshing')
  await new Promise(resolve => setTimeout(resolve, 500))
  const rc = await props.onRefresh.call(this)
  refreshLabel.value = rc ? t('common.done') : t('common.error')
  setTimeout(() => refreshLabel.value = t('common.refresh'), 2000)
}

defineExpose({
  refresh: onClick
})

</script>
