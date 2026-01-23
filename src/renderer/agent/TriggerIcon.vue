
<template>
  <HandIcon v-if="trigger === 'manual'" />
  <ClockIcon v-else-if="trigger === 'schedule'" />
  <WebhookIcon v-else-if="trigger === 'webhook'" />
  <WorkflowIcon v-else-if="trigger === 'workflow'" />
  <CircleIcon v-else />
</template>

<script setup lang="ts">

import { CircleIcon, ClockIcon, HandIcon, WebhookIcon, WorkflowIcon } from 'lucide-vue-next'

defineProps<{
  trigger: string
}>()

</script>
