<template>
  <div class="split-pane">
    <div class="sp-main">
      <header v-if="mode === 'create'">
        <BIconChevronLeft class="icon back" @click="closeCreate" />
        <div class="title">{{ t('agent.forge.create') }}</div>
      </header>
      <header v-else-if="mode === 'view' || mode === 'edit'">
        <BIconChevronLeft class="icon back" @click="selectAgent(null)" />
        <div class="title">{{ selected.name }}</div>
      </header>
      <header v-else>
        <div class="title">{{ t('agent.forge.title') }}</div>
      </header>
      <main class="empty sliding-root" :class="{ visible: mode === 'list' }" v-if="store.agents.length === 0">
        <BIconRobot @click="onCreate" />
        {{ t('agent.forge.empty') }}
      </main>
      <main class="sliding-root" :class="{ visible: mode === 'list' }" v-else>
        <List :agents="store.agents" @create="onCreate" @import-a2-a="onImportA2A"  @edit="editAgent" @run="runAgent" @view="viewAgent" @delete="deleteAgent" />
      </main>
      <main class="sliding-pane" :class="{ visible: mode !== 'list' }" @transitionend="onTransitionEnd">
        <Editor :style="{ display: isPaneVisible('create') || isPaneVisible('edit') ? 'flex' : 'none' }" :mode="mode as 'create' | 'edit'" :agent="selected" @cancel="closeCreate" @save="onSaved" />
        <View :style="{ display: isPaneVisible('view') ? 'flex' : 'none' }" :agent="selected" @run="runAgent" @edit="editAgent" @delete="deleteAgent" />
      </main>
    </div>
    <PromptBuilder :title="running?.name ?? ''" ref="builder" />
  </div>
</template>

<script setup lang="ts">
import { AgentType } from '../types/index'
import { ref, onMounted } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import A2AClient from '../services/a2a-client'
import Dialog from '../composables/dialog'
import PromptBuilder from '../components/PromptBuilder.vue'
import List from '../agent/List.vue'
import View from '../agent/View.vue'
import Editor from '../agent/Editor.vue'
import AgentRunner from '../services/runner'
import Agent from '../models/agent'

defineProps({
  extra: Object
})

type AgentForgeMode = 'list' | 'create' | 'view' | 'edit'

const mode = ref<AgentForgeMode>('list')
const prevMode = ref<AgentForgeMode>('list')
const selected = ref<Agent|null>(null)
const running = ref<Agent|null>(null)
const builder = ref(null)

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

const onCreate = (type?: AgentType) => {
  mode.value = 'create'
  selected.value = new Agent()
  selected.value.type = type || 'runnable'
}

const onImportA2A = async (type?: AgentType) => {

  let url = 'http://localhost:41241'

  while (true) {

    const value = await Dialog.show({
      title: t('agent.forge.a2a.import.title'),
      input: 'text',
      inputValue: url,
      confirmButtonText: t('common.import'),
      showCancelButton: true,
    })

    if (value.isDismissed) {
      break;
    }

    await Dialog.waitUntilClosed()

    url = value.value.trim()
    const client = new A2AClient(url)
    const agent = await client.getAgent()

    if (agent) {
      agent.type = type || 'runnable'
      window.api.agents.save(agent)
      editAgent(agent)
      break
    }

    await Dialog.show({
      title: t('agent.forge.a2a.import.error.title'),
      text: t('agent.forge.a2a.import.error.text'),
      confirmButtonText: t('common.ok'),
    })
    await Dialog.waitUntilClosed()

  }
}

const closeCreate = () => {
  selectAgent(null)
}

const onSaved = async () => {
  store.loadAgents()
  selectAgent(null)
}

const viewAgent = (agent: Agent) => {
  prevMode.value = mode.value
  mode.value = 'view'
  selected.value = agent
}

const editAgent = (agent: Agent) => {
  prevMode.value = mode.value
  mode.value = 'edit'
  selected.value = agent
}

const runAgent = (agent: Agent, opts?: Record<string, string>) => {
  running.value = agent
  builder.value.show(agent.steps[0].prompt, opts || {}, async (prompt: string) => {
    const runner = new AgentRunner(store.config, agent)
    await runner.run('manual', prompt)
    running.value = null
  })
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
      store.loadAgents()
      selectAgent(null)
    }
  })
}

</script>


<style scoped>

.split-pane {
  
  .sp-main {

    main {
    
      &.empty {

        padding: 10% 25%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 10rem;
        gap: 2rem;
        text-align: center;

        color: var(--faded-text-color);
        font-family: var(--font-family-serif);
        font-size: 16pt;
        font-weight: 500;
        line-height: 1.5;

        svg {
          cursor: pointer;
          width: 10rem;
          height: 10rem;
          opacity: 20%;
        }
      }

      &.sliding-pane {
        /* not sure why the default 100% makes it too wide here */
        /* as this does not happen for DocRepos who have the same structure */
        width: calc(100% - var(--window-menubar-width));
      }

    }
  }
}

</style>
