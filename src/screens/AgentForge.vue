<template>
  <div class="panel-content">
    <div class="content">
      <header v-if="mode === 'create'">
        <BIconChevronLeft class="icon back" @click="selectAgent(null)" />
        <div class="title">{{ t('agent.forge.create') }}</div>
      </header>
      <header v-else-if="mode === 'view'">
        <BIconChevronLeft class="icon back" @click="selectAgent(null)" />
        <div class="title">{{ selected.name }}</div>
      </header>
      <header v-else>
        <div class="title">{{ t('agent.forge.title') }}</div>
      </header>
      <main class="empty sliding-root" :class="{ hidden: mode !== 'list' }" v-if="store.agents.length === 0">
        <BIconRobot @click="onCreate" />
        {{ t('agent.forge.empty') }}
      </main>
      <main class="list sliding-root" :class="{ visible: mode === 'list' }" v-else>
        <AgentList :agents="store.agents" @create="onCreate" @run="onRun" @view="viewAgent" @delete="deleteAgent" />
      </main>
      <main class="sliding-pane" :class="{ visible: mode !== 'list' }" @transitionend="onTransitionEnd">
        <AgentEditor :style="{ display: isPaneVisible('create') ? 'flex' : 'none' }" mode="create" :agent="selected" @cancel="selectAgent(null)" @save="onSaved" />
        <AgentView :style="{ display: isPaneVisible('view') ? 'flex' : 'none' }" :agent="selected" @run="onRun" @delete="deleteAgent" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import AgentList from '../components/AgentList.vue'
import AgentView from '../components/AgentView.vue'
import AgentEditor from '../components/AgentEditor.vue'
import AgentRunner from '../services/runner'
import Agent from '../models/agent'

defineProps({
  extra: Object
})

type AgentForgeMode = 'list' | 'create' | 'view'

const mode = ref<AgentForgeMode>('list')
const prevMode = ref<AgentForgeMode>('list')
const selected = ref<Agent|null>(null)

const isPaneVisible = (paneMode: AgentForgeMode) => {
  return mode.value === paneMode || prevMode.value === paneMode
}

onMounted(() => {
})

const selectAgent = async (agent: Agent|null) => {
  if (!agent) {
    prevMode.value = mode.value
    mode.value = 'list'
    // selected reset will be done in onTransitionEnd
  } else {
    viewAgent(agent)
  }
}

const onTransitionEnd = async () => {
  if (mode.value === 'list') {
    selected.value = null
    prevMode.value = null
  }
}

const onCreate = () => {
  mode.value = 'create'
  selected.value = new Agent()
}

const onSaved = async (agent: Agent) => {
  viewAgent(agent)
}

const onRun = (agent: Agent) => {
  const runner = new AgentRunner(store.config, agent)
  runner.run('manual')
}

const viewAgent = (agent: Agent) => {
  mode.value = 'view'
  selected.value = agent
}

const deleteAgent = (agent: Agent) => {
  Dialog.show({
    title: t('agent.forge.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      window.api.agents.delete(agent.id)
    }
  })
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/panel-content.css';
</style>

<style scoped>

.panel-content {
  
  .panel {
    flex-basis: 1rem;
  }
  
  .content {

    header {
      padding-left: 2rem;
    }

    main {
    
      padding: 2rem;
      width: calc(100% - 4rem);

      &.empty {

        padding: 10% 25%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 10rem;
        gap: 2rem;
        text-align: center;

        color: var(--faded-text-color);

        svg {
          cursor: pointer;
          width: 10rem;
          height: 10rem;
          opacity: 20%;
        }
      }

      &:deep() .list-large-with-header {
        padding: 1rem 0;

        &:first-child {
          padding-top: 0;
        }

        &:last-child {
          padding-bottom: 3rem;
        }
      }
    }
  }
}

</style>
