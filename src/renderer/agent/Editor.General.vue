<template>
  <WizardStep :visible="visible" :prev-button-text="prevButtonText" :error="error" @prev="$emit('prev')" @next="onNext">
    <template #header>
      <label>{{ t('agent.create.information.title') }}</label>
    </template>
    <template #content>
      <div class="form-field">
        <label for="name">{{ t('agent.name') }}</label>
        <div class="help">{{ t('agent.create.information.help.name') }}</div>
        <input type="text" v-model="agent.name" name="name" required />
      </div>
      <div class="form-field">
        <label for="type">{{ t('agent.create.information.type') }}</label>
        <div class="help">{{ t('agent.create.information.help.type') }}</div>
        <select v-model="agent.type" name="type">
          <option value="runnable">{{ t('agent.type.runnable') }}</option>
          <option value="support">{{ t('agent.type.support') }}</option>
        </select>
      </div>
      <div class="form-field">
        <label for="description">{{ t('agent.description') }}</label>
        <div class="help">{{ t('agent.create.information.help.description') }}</div>
        <textarea v-model="agent.description" name="description" required></textarea>
      </div>
      <div class="form-field">
        <label for="goal">{{ t('agent.goal') }}</label>
        <div class="help">{{ t('agent.create.information.help.goal') }}</div>
        <textarea v-model="agent.instructions" name="goal" required></textarea>
      </div>            
    </template>
  </WizardStep>
</template>

<script setup lang="ts">
import { PropType } from 'vue'
import { t } from '../services/i18n'
import WizardStep from '../components/WizardStep.vue'
import Agent from '../../models/agent'
import { isValidUrl } from '@fal-ai/client/src/utils'

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true,
  },
  visible: {
    type: Boolean,
    default: false,
  },
  prevButtonText: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['prev', 'next'])

const validate = (): string|null => {
  if (!props.agent.name.trim().length ||
      !props.agent.description.trim().length ||
      !props.agent.instructions.trim().length) {
    return t('common.required.fieldsRequired')
  }
  return null
}

const onNext = () => {
  emit('next')
}

defineExpose({ validate })

</script>
