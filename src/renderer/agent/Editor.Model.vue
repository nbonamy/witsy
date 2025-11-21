<template>
  <WizardStep :visible="visible" @prev="$emit('prev')" @next="onNext">
    <template #header>
      <label>{{ t('agent.create.llm.title') }}</label>
      <div class="help">{{ t('agent.create.llm.help.warning') }}</div>
    </template>
    <template #content>
      <div class="form-field">
        <label>{{ t('common.llmModel') }}</label>
        <EngineModelSelect 
          :engine="agent.engine" 
          :model="agent.model" 
          @modelSelected="onModelSelected"
        />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.locale') }}</label>
        <LangSelect name="locale" v-model="agent.locale" default-text="modelSettings.localeDefault" />
      </div>
      <div class="form-field">
        <button class="secondary" @click="showSettingsDialog"><Settings2Icon />{{ t('agent.create.llm.showModelSettings') }}</button>
      </div>
    </template>
  </WizardStep>

  <EditorSettings ref="settingsDialog" :agent="agent" />
</template>

<script setup lang="ts">
import { Settings2Icon } from 'lucide-vue-next'
import { PropType, ref } from 'vue'
import EngineModelSelect from '@components/EngineModelSelect.vue'
import LangSelect from '@components/LangSelect.vue'
import WizardStep from '@components/WizardStep.vue'
import Agent from '@models/agent'
import { t } from '@services/i18n'
import EditorSettings from './Editor.Settings.vue'

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

const settingsDialog = ref<InstanceType<typeof EditorSettings>>()

const emit = defineEmits(['prev', 'next', 'show-settings'])

const validate = (): string|null => {
  return null
}

const onNext = () => {
  emit('next')
}

const onModelSelected = (engine: string, model: string) => {
  props.agent.engine = engine
  props.agent.model = model
}

const showSettingsDialog = () => {
  settingsDialog.value?.show()
}

defineExpose({ validate })

</script>

<style scoped>

.engine-model-select {
  width: calc(100% - 2rem);
}

.settings-trigger {
  cursor: pointer;
  display: flex;
  align-items: center;
}

</style>