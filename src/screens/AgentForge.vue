<template>
  <div class="agent-forge window" @keydown="onKeyDown">
    <div class="panel">
      <div class="actions">
        <BIconPlusSquare @click="onCreate" />
      </div>
      <AgentList :agents="store.agents" :selected="selected" @select="selectAgent" @menu="showContextMenu" />
    </div>
    <div class="content">
      <div class="toolbar">
        <template v-if="selected">
          <div class="title">{{ selected.name }}</div>
          <div class="action run" @click="onRun">
            <BIconPlayFill />
          </div>
        </template>
      </div>
      <div class="agent" v-if="selected">
        <AgentView :agent="selected" @run="onRun" @edit="editAgent" @delete="deleteAgent" />
      </div>
      <form class="empty" v-else>
        <div>{{ t('agent.forge.empty') }}</div>
        <button @click="onCreate" class="create-button">
          <BIconPlusSquare />
          {{ t('agent.forge.create') }}
        </button>
      </form>
    </div>
  </div>
  <AgentEditor ref="agentEditor" />
  <ContextMenu v-if="showMenu" @close="closeContextMenu" :actions="contextMenuActions()" @action-clicked="handleActionClick" :x="menuX" :y="menuY" />
</template>

<script setup lang="ts">
import { Agent } from '../types/index'
import { ref, Ref, onMounted } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import ContextMenu from '../components/ContextMenu.vue'
import AgentList from '../components/AgentList.vue'
import AgentView from '../components/AgentView.vue'
import AgentEditor from './AgentEditor.vue'
import AgentRunner from '../services/runner'

defineProps({
  extra: Object
})

const selected: Ref<Agent> = ref(null)
const agentEditor: Ref<typeof AgentEditor> = ref(null)

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow: Ref<Agent|null> = ref(null)

const contextMenuActions = () => [
  { label: t('common.edit'), action: 'edit' },
  //{ label: t('common.rename'), action: 'rename' },
  { label: t('common.delete'), action: 'delete' },
]

store.loadSettings()
store.loadAgents()

onMounted(() => {

  // keyboard
  document.addEventListener('keydown', onKeyDown)
})

const selectAgent = (agent: Agent) => {
  selected.value = agent
}

const onCreate = () => {
  agentEditor.value.open()
} 

const showContextMenu = ({ event, agent }: { event: MouseEvent, agent: Agent }) => {
  showMenu.value = true
  targetRow.value = agent
  menuX.value = event.clientX
  menuY.value = event.clientY
}

const closeContextMenu = () => {
  showMenu.value = false;
}

const handleActionClick = async (action: string) => {
  
  // close
  closeContextMenu()

  // init
  let agent = targetRow.value
  if (!agent) return

  // process
  if (action === 'edit') {
    editAgent(agent)
  } else if (action === 'delete') {
    deleteAgent(agent)
  }
}

const editAgent = (agent: Agent) => {
  agentEditor.value.open(agent)
}

const deleteAgent = (agent: Agent) => {
  Dialog.show({
    title: t('agent.forge.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {


    }
  })
}

const onKeyDown = (event: KeyboardEvent) => {
}

const onRun = () => {
  const runner = new AgentRunner(store.config, selected.value)
  runner.run('manual')
}

</script>

<style scoped>
@import '../../css/form.css';
@import '../../css/panel-content.css';
</style>

<style scoped>

.panel {
  flex: 0 0 var(--forge-panel-width);
  > .hidden {
    display: none;
  }
}

.content .empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 32px;
  opacity: 0.66;
  text-align: center;
  line-height: 140%;
  font-family: var(--serif-font);
  font-size: 14pt;
} 

</style>