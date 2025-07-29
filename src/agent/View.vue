
<template>

  <div class="agent-view master-detail" v-if="agent">

    <div class="master-main">
      <Info :agent="agent" :runs="runs" @run="emit('run', $event)" @edit="emit('edit', $event)" @delete="emit('delete', $event)" />
      <History :agent="agent" :runs="runs" :run="run" @click="run = $event" @clear="clearHistory" />
    </div>

    <div class="master-detail">
      <Run v-if="run" :run="run" @close="run = null" @delete="deleteRun"/>
    </div>

  </div>


</template>


<script setup lang="ts">

import { Agent, AgentRun } from '../types/index'
import { ref, PropType, onMounted, watch } from 'vue'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import Info from './Info.vue'
import History from './History.vue'
import Run from './Run.vue'

const runs = ref<AgentRun[]>([])
const run = ref<AgentRun|null>(null)

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    default: null,
  },
})

const emit = defineEmits(['run', 'edit', 'clearHistory', 'delete'])

onMounted(() => {
  watch(() => props.agent, () => {
    if (!props.agent) return
    runs.value = window.api.agents.getRuns(props.agent.id)
    if (runs.value.length > 0) {
      run.value = runs.value[runs.value.length - 1]
    } else {
      run.value = null
    }
  }, { immediate: true })
})

const deleteRun = () => {

  Dialog.show({
    title: t('agent.run.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.agents.deleteRun(props.agent.id, run.value.id)
      runs.value = runs.value.filter(r => r.id !== run.value.id)
      run.value = null
    }
  })
}

const clearHistory = () => {
  Dialog.show({
    title: t('agent.history.confirmClear'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.clear'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.agents.deleteRuns(props.agent.id)
      runs.value = []
      run.value = null
    }
  })
}

</script>


<style scoped>

.agent-view {

  --agent-font-size: 11pt;

  margin: 1rem;

  .master-main, .master-detail {
    flex: 1;
    max-width: 50%;
  }

  .master-detail {
    height: calc(100vh - 6rem);
  }

  .panel {
    padding: 1rem;

    &:deep()  .panel-body {
      gap: 0rem;
      font-size: var(--agent-font-size);
    }

  }

}



</style>
