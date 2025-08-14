<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.models') }}</div>
    </header>
    <main>

      <div class="ctas">
        <HeroPanel variant="online" @button-click="showOnlinePanel">
          <template #title>Online Models</template>
          <template #subtitle>Connect your online model providers to access them within Wrkspace.</template>
          <template #button><BIconPlusLg /> Connect Online Models</template>
        </HeroPanel>

        <HeroPanel variant="local" @button-click="showLocalPanel">
          <template #title>Local Models</template>
          <template #subtitle>Run LLMs locally on your own device for greater flexibility and security.</template>
          <template #button><BIconDownload /> Install Local Models</template>
        </HeroPanel>
      </div>

      <div class="available">
        <ModelList 
          :models="onlineModels"
          variant="online"
          @remove-model="removeModel"
        >
          <template #header>Connected Online Models</template>
          <template #empty>No models connected.</template>
        </ModelList>

        <ModelList 
          :models="localModels"
          variant="local"
          @remove-model="removeModel"
        >
          <template #header>Installed Local Models</template>
          <template #empty>No models connected.</template>
        </ModelList>
      </div>
      
    </main>
  </div>

  <SideModelList 
    v-if="showOnlinePanelState"
    ref="onlinePanelRef"
    type="online"
    :workspace="workspace"
    @toggle-model="toggleModel"
    @closed="onOnlinePanelClosed"
  />

  <SideModelList 
    v-if="showLocalPanelState"
    ref="localPanelRef"
    type="local"
    :workspace="workspace"
    @toggle-model="toggleModel"
    @closed="onLocalPanelClosed"
  />

</template>

<script setup lang="ts">

import { Workspace } from '../types/workspace'
import { computed, ref } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import LlmFactory from '../llms/llm'
import LlmManager from '../llms/manager'
import HeroPanel from '../components/HeroPanel.vue'
import ModelList from '../components/ModelList.vue'
import SideModelList from '../components/SideModelList.vue'

const llmManager: LlmManager = LlmFactory.manager(store.config)

const onlinePanelRef = ref<InstanceType<typeof SideModelList>>()
const localPanelRef = ref<InstanceType<typeof SideModelList>>()

const workspace = ref<Workspace>(undefined)
const showOnlinePanelState = ref(false)
const showLocalPanelState = ref(false)

const onlineModels = computed(() => {
  if (!workspace.value) {
    return []
  }
  return workspace.value.models?.filter(m => llmManager.isEngineOnline(m.engine)) || []
})

const localModels = computed(() => {
  if (!workspace.value) {
    return []
  }
  return workspace.value.models?.filter(m => llmManager.isEngineLocal(m.engine)) || []
})

const load = () => {
  workspace.value = window.api.workspace.load(store.config.workspaceId)
}

const showOnlinePanel = () => {
  showOnlinePanelState.value = true
}

const showLocalPanel = () => {
  showLocalPanelState.value = true
}

const onOnlinePanelClosed = () => {
  showOnlinePanelState.value = false
}

const onLocalPanelClosed = () => {
  showLocalPanelState.value = false
}

const removeModel = (model: any) => {
  toggleModel(model.engine, model.model)
}

const toggleModel = (engine: string, model: string) => {

  // we should have a workspace
  if (!workspace.value) {
    return
  }

  // we need a model list
  if (!workspace.value.models) {
    workspace.value.models = []
  }

  // find favorite model
  const favorite = workspace.value.models.find(m => m.engine == engine && m.model == model)
  if (favorite) {
    workspace.value.models = workspace.value.models.filter(m => m.engine != engine || m.model != model)
  } else {
    workspace.value.models.push({
      id: `${engine}-${model}`,
      engine,
      model: model
    })
  }

  // save
  window.api.workspace.save(JSON.parse(JSON.stringify(workspace.value)))


}

const save = () => {

}


defineExpose({ load, save })


</script>




<style scoped>

.tab-content main {
  align-self: stretch;
  gap: 2rem;

  .ctas {
    align-self: stretch;
    display: flex;
    flex-direction: row;
    gap: 1rem;

    :deep(.hero-panel) {
      flex: 1;
    }
  }

  .available {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

}

</style>

