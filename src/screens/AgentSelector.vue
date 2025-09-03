<template>
  <ModalDialog id="agent-selector" ref="dialog" type="window" @save="onSave">
    <template #header>
      {{ t('agentSelector.title') }}
    </template>
    <template #body>
      <div class="agents sticky-table-container">
        <table>
          <thead>
            <tr>
              <th>&nbsp;</th>
              <th>{{ t('common.name') }}</th>
              <th>{{ t('common.description') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="support in supportAgents" :key="support.uuid" class="agent" @click="toggleAgent(support)">
              <td class="agent-enabled"><input type="checkbox" :checked="selection.includes(support.uuid)" /></td>
              <td class="agent-name">{{ support.name }}</td>
              <td class="agent-description"><div>{{ support.description }}</div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <template #footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="none" @click="selection = []" class="secondary">{{ t('common.unselectAll') }}</button>
        <button name="save" @click="onSave" class="primary">{{ t('common.save') }}</button>
      </div>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
import Agent from '../models/agent'

const props = defineProps({
  excludeAgentId: {
    type: String,
    default: null,
  },
})

const dialog = ref(null)
const selection = ref<string[]>([])

const emit = defineEmits(['save'])

const supportAgents = computed(() => {
  return store.agents
    .filter(a => a.uuid !== props.excludeAgentId)
    .sort((a, b) => a.name.localeCompare(b.name))
})

const toggleAgent = (support: Agent) => {
  if (selection.value.includes(support.uuid)) {
    selection.value = selection.value.filter(a => a !== support.uuid)
  } else {
    selection.value.push(support.uuid)
  }
}

const close = () => {
  dialog.value.close()
}

const onCancel = () => {
  close()
}

const onSave = () => {
  close()
  emit('save', selection.value)
}

defineExpose({
  show: async (agents: string[]) => {
    selection.value = JSON.parse(JSON.stringify(agents || []))
    dialog.value.show()
  },
  close,
})

</script>

<style>

#agent-selector {
  
  .agents {
    
    max-height: 20rem;
    overflow-y: auto;

    .agent {

      cursor: pointer;
    
      th, td {
        vertical-align: top;
        padding: 0.5rem;
        
        div {
          white-space: wrap;
          max-height: 3lh;
          overflow-y: clip;
          text-overflow: ellipsis;
        }
      }

    }
  }
}

</style>
