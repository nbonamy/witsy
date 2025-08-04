<template>
  <WizardStep :visible="visible" :error="error" @prev="$emit('prev')" @next="onNext">
    <template #header>
      <label>{{ t('agent.create.goal.title') }}</label>
    </template>
    <template #content>
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
import Agent from '../models/agent'

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true,
  },
  visible: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['prev', 'next'])

const onNext = () => {
  if (!props.agent.instructions.trim().length) {
    emit('next', { error: t('common.required.fieldsRequired') })
    return
  }
  emit('next')
}
</script>

<style scoped>
textarea[name="goal"] {
  min-height: 15lh !important;
}
</style>
