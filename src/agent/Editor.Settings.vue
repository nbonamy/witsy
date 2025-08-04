<template>
  <WizardStep :visible="visible" @prev="$emit('prev')" @next="onNext">
    <template #header>
      <label>{{ t('agent.create.settings.title') }}</label>
    </template>
    <template #content>
      <!-- <div class="form-field">
        <label>{{ t('modelSettings.streaming') }}</label>
        <select name="streaming" v-model="agent.disableStreaming">
      <option :value="false">{{ t('common.enabled') }}</option>
      <option :value="true">{{ t('common.disabled') }}</option>
        </select>
      </div> -->
      <div class="form-field">
        <label>{{ t('modelSettings.contextWindowSize') }}</label>
        <input type="text" name="contextWindowSize" v-model="agent.modelOpts.contextWindowSize" :placeholder="t('modelSettings.defaultModelValue')" />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.maxCompletionTokens') }}</label>
        <input type="text" name="maxTokens" v-model="agent.modelOpts.maxTokens" :placeholder="t('modelSettings.defaultModelValue')" />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.temperature') }}</label>
        <input type="text" name="temperature" v-model="agent.modelOpts.temperature" :placeholder="t('modelSettings.defaultModelValue')" />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.topK') }}</label>
        <input type="text" name="top_k" v-model="agent.modelOpts.top_k" :placeholder="t('modelSettings.defaultModelValue')" />
      </div>
      <div class="form-field">
        <label>{{ t('modelSettings.topP') }}</label>
        <input type="text" name="top_p" v-model="agent.modelOpts.top_p" :placeholder="t('modelSettings.defaultModelValue')" />
      </div>
    </template>
  </WizardStep>
</template>

<script setup lang="ts">
import { PropType } from 'vue'
import { t } from '../services/i18n'
import WizardStep from '../components/WizardStep.vue'
import Agent from '../models/agent'

defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true,
  },
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['prev', 'next'])

const onNext = () => {
  emit('next')
}
</script>
