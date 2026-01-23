
<template>

  <div class="history">

    <div class="header">
      <select v-model="showWorkflows" class="history-filter">
        <option value="all">{{ t('agent.view.filter.all') }}</option>
        <option value="exclude">{{ t('agent.view.filter.exclude_workflow') }}</option>
      </select>
      <ButtonIcon
        class="clear"
        v-tooltip="{ text: t('agent.help.clearHistory'), position: 'bottom-left' }"
        @click="$emit('clear')"
      ><CalendarXIcon /></ButtonIcon>
    </div>

    <div v-if="filteredRuns.length === 0" class="empty">
      {{ t('agent.history.empty') }}
    </div>

    <div v-else class="items">
      <div
        v-for="run in filteredRuns"
        :key="run.uuid"
        class="item"
        :class="{ selected: selection.includes(run.uuid) }"
        @click="$emit('click', $event, run)"
        @contextmenu.prevent="showContextMenu($event, run)"
      >
        <div class="icon">
          <StatusIcon :status="run.status" />
        </div>
        <div class="info">
          <div class="title">{{ timeAgo.format(new Date(run.createdAt)) }}</div>
          <div class="subtitle">
            <TriggerIcon :trigger="run.trigger" />
            {{ t(`agent.trigger.${run.trigger}`) }}</div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">

import { CalendarXIcon } from 'lucide-vue-next'
import StatusIcon from './StatusIcon.vue'
import TriggerIcon from './TriggerIcon.vue'
import { PropType, computed } from 'vue'
import ButtonIcon from '@components/ButtonIcon.vue'
import { useTimeAgo } from '@composables/ago'
import { t } from '@services/i18n'
import { Agent, AgentRun } from 'types/agents'

const timeAgo = useTimeAgo()

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true
  },
  runs: {
    type: Array as PropType<AgentRun[]>,
    required: true,
  },
  selection: {
    type: Array as PropType<string[]>,
    required: true,
  },
  showWorkflows: {
    type: String as PropType<'all' | 'exclude'>,
    required: true,
  },
})

const emit = defineEmits(['clear', 'click', 'update:show-workflows', 'context-menu'])

const showWorkflows = computed({
  get: () => props.showWorkflows,
  set: (value: 'all' | 'exclude') => emit('update:show-workflows', value)
})

const filteredRuns = computed(() => {
  const runsToShow = props.showWorkflows === 'all'
    ? props.runs
    : props.runs.filter(run => run.trigger !== 'workflow')
  return [...runsToShow].reverse()
})

const showContextMenu = (event: MouseEvent, run: AgentRun) => {
  emit('context-menu', { event, run })
}

</script>

<style scoped>

.history {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.history-filter {
  margin-right: var(--space-4);
  width: auto;
  flex: 1;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--faded-text-color);
  font-family: var(--font-family-serif);
}

.items {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.item {
  cursor: pointer;
  padding: 0.5rem 0.25rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  border-radius: 4px;
  border: 1px solid transparent;
  gap: 0.5rem;
}

.item .icon {
  width: var(--icon-lg);
  height: var(--icon-lg);
  flex-shrink: 0;

  svg {
    width: 100%;
    height: 100%;
  }
}

.item .info {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-right: var(--space-8);
  gap: var(--space-2);
}

.item .info .title {
  flex: 1;
  font-size: var(--font-size-14);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item .info .subtitle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-12);
  color: var(--faded-text-color);
  flex-shrink: 0;
  white-space: nowrap;
  svg {
    width: 12px;
    height: 12px;
  }
}

.item.selected {
  background-color: var(--sidebar-selected-color);
}

</style>
