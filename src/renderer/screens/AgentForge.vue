<template>
  <div class="split-pane">

    <template v-if="mode === 'list'">
    
      <template v-if="store.agents.length === 0">
        <Empty class="sp-main" @click="onCreate()" />
      </template>

      <template v-else>
        <List class="sp-main" @create="onCreate" @import-a2-a="onImportA2A" @import-json="onImportJson" @export="onExport" @duplicate="duplicateAgent" @edit="editAgent" @run="runAgent" @view="viewAgent" @delete="deleteAgent" />
      </template>

    </template>

    <template v-else-if="mode === 'create' || mode === 'edit'">
      <Editor class="sp-main" :mode="mode as 'create' | 'edit'" :agent="selected" @cancel="closeCreate" @save="onSaved" />
    </template>

    <template v-else-if="mode === 'view'">
      <View class="sp-main" :agent="selected" @run="runAgent" @edit="editAgent" @delete="deleteAgent" @close="selectAgent(null)"/>
    </template>

    <CreateAgentRun :title="running?.name ?? ''" ref="builder" />
  
  </div>

</template>

<script setup lang="ts">

import { ref } from 'vue'
import Editor from '../agent/Editor.vue'
import Empty from '../agent/Empty.vue'
import List from '../agent/List.vue'
import View from '../agent/View.vue'
import CreateAgentRun from '../components/CreateAgentRun.vue'
import Dialog from '../utils/dialog'
import Agent from '../../models/agent'
import A2AClient from '../services/a2a-client'
import AgentWorkflowExecutor from '../services/agent_executor_workflow'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { AgentType } from 'types/agents'
import { FileContents } from 'types/file'

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
  builder.value.show(agent, opts || {}, async (values: Record<string, string>) => {
    const executor = new AgentWorkflowExecutor(store.config, store.workspace.uuid, agent)
    await executor.run('manual', values)
    running.value = null
  })
}

const duplicateAgent = (data: any) => {
  const agent = Agent.fromJson(data)
  const duplicated = agent.duplicate(t('agent.copySuffix'))
  window.api.agents.save(store.config.workspaceId, duplicated)
  store.loadAgents()
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
</style>
