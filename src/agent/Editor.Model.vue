<template>
  <WizardStep :visible="visible" @prev="$emit('prev')" @next="onNext">
    <template #header>
      <label>{{ t('agent.create.llm.title') }}</label>
      <div class="help">{{ t('agent.create.llm.help.warning') }}</div>
    </template>
    <template #content>
      <div class="form-field">
        <label>{{ t('common.llmProvider') }}</label>
        <EngineSelect v-model="agent.engine" :default-text="t('agent.create.llm.lastOneUsed')" @change="onChangeEngine"/>
      </div>
      <div class="form-field">
        <label>{{ t('common.llmModel') }}</label>
        <ModelSelect v-model="agent.model" :engine="agent.engine" :default-text="t('agent.create.llm.lastOneUsed')" @change="onChangeModel"/>
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.locale') }}</label>
        <LangSelect name="locale" v-model="agent.locale" default-text="modelSettings.localeDefault" />
      </div>
    </template>
    <template #buttons>
      <button @click="$emit('show-settings')" v-if="hasSettings">{{ t('agent.create.llm.showModelSettings') }}</button>
    </template>
  </WizardStep>
</template>

<script setup lang="ts">
import { PropType } from 'vue'
import { t } from '../services/i18n'
import WizardStep from '../components/WizardStep.vue'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LangSelect from '../components/LangSelect.vue'
import Agent from '../models/agent'
import LlmFactory, { ILlmManager } from '../llms/llm'
import { store } from '../services/store'

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true,
  },
  visible: {
    type: Boolean,
    default: false,
  },
  hasSettings: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['prev', 'next', 'show-settings'])

const llmManager: ILlmManager = LlmFactory.manager(store.config)

const onNext = () => {
  emit('next')
}

const onChangeEngine = () => {
  props.agent.model = llmManager.getDefaultChatModel(props.agent.engine, false)
  onChangeModel()
}

const onChangeModel = () => {
  // Additional model change logic can be added here
}
</script>
