<template>
  <ButtonIcon class="stop" v-tooltip="{ text: tooltip, position: tooltipPosition }">
    <SquareIcon />
    <span class="count">{{ executions.length > 9 ? '✱' : executions.length }}</span>
  </ButtonIcon>
</template>

<script setup lang="ts">

import { PropType } from 'vue'
import { SquareIcon } from 'lucide-vue-next'
import ButtonIcon from '@components/ButtonIcon.vue'
import { Agent } from 'types/agents'

defineProps({
  executions: {
    type: Array as PropType<Array<{ id: string, agent: Agent, startTime: number }>>,
    required: true
  },
  tooltip: {
    type: String,
    required: true
  },
  tooltipPosition: {
    type: String,
    default: 'top-left'
  }
})

</script>

<style scoped>

.button-icon.stop {
  position: relative;
}

.count {
  position: absolute;
  top: 11px;
  left: 6px;
  font-size: 10px;
  padding: 2px 4px;
  min-width: 16px;
  text-align: center;
  line-height: 1;
}

</style>
