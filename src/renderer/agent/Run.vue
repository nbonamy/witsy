
<template>

  <div class="run-view" v-if="run">

    <!-- Left: Execution Flow -->
    <div class="execution-flow-pane">
      <ExecutionFlow :agent="agent" :run="run" :selected-index="selectedStepIndex" @select="onSelectStep" />
    </div>

    <!-- Right: Step Details -->
    <div class="details-pane">
    
      <header>
    
        <div class="title">{{ t('agent.run.details') }}</div>
        
        <div class="actions">
          <ButtonIcon class="delete" v-tooltip="{ text: t('agent.help.deleteRun'), position: 'bottom-left' }" @click="(event) => { event?.stopPropagation(); emit('delete') }">
            <Trash2Icon />
          </ButtonIcon>
        </div>
    
      </header>
      
      <div class="step-detail">
        <RunInfo v-if="selectedStepIndex === 0" :agent="agent" :run="run" />
        <StepDetail v-else :agent="agent" :run="run" :step-index="selectedStepIndex" />
      </div>
    
    </div>

  </div>

  <div class="run-placeholder empty" v-else>
    <div class="placeholder-text">{{ t('agent.run.selectRun') }}</div>
  </div>

</template>

<script setup lang="ts">

import ButtonIcon from '@components/ButtonIcon.vue'
import { t } from '@services/i18n'
import { Trash2Icon } from 'lucide-vue-next'
import { Agent, AgentRun } from 'types/agents'
import { PropType, ref, watch } from 'vue'
import ExecutionFlow from './ExecutionFlow.vue'
import RunInfo from './RunInfo.vue'
import StepDetail from './StepDetail.vue'

const selectedStepIndex = ref(0)

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true
  },
  run: {
    type: Object as PropType<AgentRun>,
    default: null
  }
})

const emit = defineEmits(['delete'])

// Reset step index when run changes
watch(() => props.run?.uuid, () => {
  selectedStepIndex.value = 0
})

const onSelectStep = (index: number) => {
  selectedStepIndex.value = index
}

</script>

<style scoped>

.run-view {
  display: flex;
  flex: 1;
  min-height: 0;
}

.execution-flow-pane {
  flex: 0 0 500px;
}

.details-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--sidebar-border-color);
  background-color: var(--background-color);
  min-width: 0;

  header {
    flex-shrink: 0;
    padding: 16px;
    border-bottom: 1px solid var(--sidebar-border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;

    .title {
      font-weight: 500;
    }
  }

  .step-detail {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
    gap: 1rem;
  }
}

.run-placeholder.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  .placeholder-text {
    font-family: var(--font-family-serif);
    font-size: 20px;
    color: var(--faded-text-color);
  }
}

</style>
