
<template>

  <div class="agent-view" v-if="agent">

    <div class="viewer" v-if="!editing">
    
      <div class="header panel">
        <div class="panel-header">
          <label>{{ t('agent.view.header') }}</label>
          <BIconPlayCircle v-if="agent.type === 'runnable'" class="icon run" @click="onRun" />
          <BIconPencil class="icon edit" @click="onEdit" />
          <BIconTrash class="icon delete" @click="onDelete" />
        </div>
        <div class="form panel-body form-large">
          <div class="form-field">
            <label>{{ t('agent.description') }}</label>
            {{ agent.description }}
          </div>
          <div class="form-field">
            <label>{{ t('agent.runCount') }}</label>
            {{ runs.length }}
          </div>
          <div class="form-field">
            <label>{{ t('agent.lastRun') }}</label>
            {{ lastRun }}
          </div>
          <div class="form-field" v-if="agent.schedule">
            <label>{{ t('agent.nextRun') }}</label>
            {{ nextRun }}
          </div>
        </div>

      </div>

      <div class="runs panel">
        <div class="header">
          <label>{{ t('agent.view.history') }}</label>
          <BIconCalendarX class="icon clear" v-if="agent.schedule" @click="onClearHistory" />
        </div>
        <div class="list">
          <History :agent="agent" :runs="runs" v-if="runs.length"/>
          <div class="empty" v-else>
            {{ t('agent.history.empty') }}
          </div>
        </div>
      </div>
    
    </div>

    <Editor class="editor" mode="create" :agent="agent" @cancel="editing = false;" @save="editing = false" />
  
  </div>

</template>


<script setup lang="ts">

import { Agent, AgentRun } from '../types/index'
import { ref, PropType, onMounted, watch, computed } from 'vue'
import { t } from '../services/i18n'
import { CronExpressionParser } from 'cron-parser'
import Editor from './Editor.vue'
import History from './History.vue'

const runs= ref<AgentRun[]>([])
const editing = ref(false)

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    default: null,
  },
})

const emit = defineEmits(['run', 'edit', 'clearHistory', 'delete'])

const lastRun = computed(() => {
  if (runs.value.length === 0) return t('agent.history.neverRun')
  const lastRun = runs.value[runs.value.length - 1]
  return new Date(lastRun.createdAt).toLocaleString()
})

const nextRun = computed(() => {
  if (!props.agent.schedule) return ''
  const schedule = CronExpressionParser.parse(props.agent.schedule)
  const next = schedule.next().toDate()
  return next.toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale, { dateStyle: 'full', timeStyle: 'short' })
})

onMounted(() => {
  watch(() => props.agent, () => {
    if (!props.agent) return
    editing.value = false
    runs.value = window.api.agents.getRuns(props.agent.id)
  }, { immediate: true })
})

const onRun = () => {
  emit('run', props.agent)
}

const onEdit = () => {
  editing.value = true
}

const onClearHistory = () => {
  window.api.agents.deleteRuns(props.agent.id)
}

const onDelete = () => {
  emit('delete', props.agent)
}


</script>


<style scoped>

.agent-view {
  
  display: flex;
  flex-direction: row;
  height: 100%;

  .viewer {
  
    .header {

      .list {
        gap: 0px;
      }

      .form-field {
        align-items: flex-start;
        font-size: 10.5pt;

        label {
          min-width: 120px;
          margin-right: 16px;
          font-weight: bold;
          text-align: right;
        }

        label::after {
          content: none !important;
        }
        
      }

    }

    .runs .list {
      overflow-x: scroll;
    }

  }

  .editor {
    flex: 1;
    width: 100%;
  }

}



</style>
