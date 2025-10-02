<template>
  <div class="split-pane">

    <template v-if="mode === 'list'">
    
      <template v-if="store.agents.length === 0">
        <div class="sp-main">
          <main class="empty">
            <IconAgent @click="onCreate()" />
            {{ t('agent.forge.empty') }}
          </main>
        </div>
      </template>

      <template v-else>
        <List class="sp-main" :agents="store.agents" @create="onCreate" @import-a2-a="onImportA2A" @import-json="onImportJson" @export="onExport" @edit="editAgent" @run="runAgent" @view="viewAgent" @delete="deleteAgent" />
      </template>

    </template>

    <template v-else-if="mode === 'create' || mode === 'edit'">
      <Editor class="sp-main" :mode="mode as 'create' | 'edit'" :agent="selected" @cancel="closeCreate" @save="onSaved" />
    </template>

    <template v-else-if="mode === 'view'">
      <View class="sp-main" :agent="selected" @run="runAgent" @edit="editAgent" @delete="deleteAgent" @close="selectAgent(null)"/>
    </template>

    <PromptBuilder :title="running?.name ?? ''" ref="builder" />
  
  </div>

</template>

<script setup lang="ts">

import { ref } from 'vue'
import IconAgent from '../../assets/agent.svg?component'
import Editor from '../agent/Editor.vue'
import List from '../agent/List.vue'
import View from '../agent/View.vue'
import PromptBuilder from '../components/PromptBuilder.vue'
import Dialog from '../composables/dialog'
import Agent from '../models/agent'
import A2AClient from '../services/a2a-client'
import { t } from '../services/i18n'
import AgentRunner from '../services/runner'
import { store } from '../services/store'
import { AgentType } from '../types/index'
import { FileContents } from '../types/file'

defineProps({
  extra: Object
})

type AgentForgeMode = 'list' | 'create' | 'view' | 'edit'

const mode = ref<AgentForgeMode>('list')
const prevMode = ref<AgentForgeMode>('list')
const selected = ref<Agent|null>(null)
const running = ref<Agent|null>(null)
const builder = ref(null)

const selectAgent = async (agent: Agent|null) => {
  if (!agent) {
    prevMode.value = mode.value
    mode.value = 'list'
    // selected reset will be done in onTransitionEnd
  } else {
    viewAgent(agent)
  }
}

const onCreate = (type?: AgentType) => {
  
  const agent = new Agent()
  if (store.workspace.models?.length) {
    const model = store.workspace.models[0]
    agent.engine = model.engine
    agent.model = model.model
  } else {
    agent.engine = 'openai'
    agent.model = 'gpt-4.1'
  }
  
  mode.value = 'create'
  selected.value = agent
  selected.value.type = type ?? 'runnable'
}

const onImportA2A = async (type?: AgentType) => {

  let url = 'http://localhost:41241'

  while (true) {

    const value = await Dialog.show({
      title: t('agent.forge.a2a.import.title'),
      text: t('agent.forge.a2a.import.text'),
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
      window.api.agents.save(store.config.workspaceId, agent)
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
    const runner = new AgentRunner(store.config, store.workspace.uuid, agent)
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
      window.api.agents.delete(store.config.workspaceId, agent.uuid)
      store.loadAgents()
      selectAgent(null)
    }
  })
}

const onExport = (agent: Agent) => {
  const jsonContent = JSON.stringify(agent, null, 2)
  const encodedContent = window.api.base64.encode(jsonContent)

  window.api.file.save({
    contents: encodedContent,
    properties: {
      filename: `${agent.name}.json`,
      prompt: true
    }
  })
}

const onImportJson = async () => {
  try {
    const file = window.api.file.pickFile({
      filters: [{ name: 'Agent JSON', extensions: ['json'] }]
    })

    if (!file) return

    const fileContents = file as FileContents
    const jsonContent = window.api.base64.decode(fileContents.contents)
    const importedAgent = Agent.fromJson(JSON.parse(jsonContent))

    // Check for UUID conflict
    const existingAgent = store.agents.find(a => a.uuid === importedAgent.uuid)

    if (existingAgent) {
      const result = await Dialog.show({
        title: t('agent.forge.import.conflict.title'),
        text: t('agent.forge.import.conflict.text'),
        confirmButtonText: t('agent.forge.import.conflict.overwrite'),
        denyButtonText: t('agent.forge.import.conflict.createNew'),
        showDenyButton: true,
        showCancelButton: true,
      })

      await Dialog.waitUntilClosed()

      if (result.isDismissed) return

      // If user chose "Create New", generate new UUID
      if (result.isDenied) {
        importedAgent.uuid = crypto.randomUUID()
        importedAgent.createdAt = Date.now()
        importedAgent.updatedAt = Date.now()
      }
    }

    window.api.agents.save(store.config.workspaceId, importedAgent)
    store.loadAgents()

  } catch (error) {
    console.error('Error importing agent:', error)
    await Dialog.show({
      title: t('agent.forge.import.error.title'),
      text: t('agent.forge.import.error.text'),
      confirmButtonText: t('common.ok'),
    })
    await Dialog.waitUntilClosed()
  }
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
        font-size: 22px;
        font-weight: var(--font-weight-medium);
        line-height: 1.5;

        svg {
          cursor: pointer;
          width: 10rem;
          height: 10rem;
          opacity: 20%;
        }
      }

    }
  }
}

</style>
