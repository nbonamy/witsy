
<template>
  <CheckCircle2Icon v-if="status === 'success'" class="success" />
  <XCircleIcon v-else-if="status === 'error'" class="error" />
  <Spinner v-else-if="status === 'running'" class="running" :circle="true" />
  <BanIcon v-else-if="status === 'canceled'" class="canceled" />
  <CircleIcon v-else class="pending" />
</template>

<script setup lang="ts">

import { BanIcon, CheckCircle2Icon, CircleIcon, XCircleIcon } from 'lucide-vue-next'
import Spinner from '@components/Spinner.vue'
import { AgentRunStatus } from 'types/agents'

defineProps<{
  status: AgentRunStatus | string
}>()

</script>

<style scoped>

.success { color: var(--color-success); }
.error { color: var(--color-error); }
.canceled { color: var(--color-warning); }
.pending { color: var(--faded-text-color); }

.running:deep() {
  width: 100% !important;
  height: 100% !important;
  svg {
    width: 100% !important;
    height: 100% !important;
    stroke: var(--color-primary) !important;
    opacity: 1.0 !important;
    animation-duration: 2.5s !important;
  }
}

</style>
