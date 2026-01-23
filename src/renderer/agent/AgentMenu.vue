
<template>
  <ContextMenuTrigger :position="position">
    <template #menu>
      <div class="item edit" @click="emit('edit', agent)">
        <PencilIcon /> {{ t('agent.help.edit') }}
      </div>
      <div class="item export" @click="emit('export', agent)">
        <DownloadIcon /> {{ t('agent.help.export') }}
      </div>
      <div class="item duplicate" @click="emit('duplicate', agent)">
        <CopyIcon /> {{ t('agent.help.duplicate') }}
      </div>
      <div class="item delete danger" @click="emit('delete', agent)">
        <Trash2Icon /> {{ t('agent.help.delete') }}
      </div>
    </template>
  </ContextMenuTrigger>
</template>

<script setup lang="ts">

import { CopyIcon, DownloadIcon, PencilIcon, Trash2Icon } from 'lucide-vue-next'
import { Agent } from 'types/agents'
import ContextMenuTrigger from '@components/ContextMenuTrigger.vue'
import { type MenuPosition } from '@components/ContextMenuPlus.vue'
import { t } from '@services/i18n'

defineProps<{
  agent: Agent
  position?: MenuPosition
}>()

const emit = defineEmits<{
  edit: [agent: Agent]
  export: [agent: Agent]
  duplicate: [agent: Agent]
  delete: [agent: Agent]
}>()

</script>
