<template>
  <WizardStep :visible="visible" :show-footer="!generating" :prev-button-text="t('common.cancel')" :next-button-text="nextButtonText" :error="error" @prev="$emit('prev')" @next="onNext">
    <template #header>
      <label>{{ t('agent.create.generator.title') }}</label>
      <div class="help">{{ t('agent.create.generator.description') }}</div>
    </template>
    <template #content>
      
      <!-- Input fields (hidden during generation and after generation) -->
      <div v-if="!generating && !generatedAgent">
        <div class="form-field">
          <label for="description">{{ t('agent.create.generator.describe') }}</label>
          <div class="help">{{ t('agent.create.generator.help.describe') }}</div>
          <VoiceTextarea 
            v-model="description" 
            name="description" 
            :placeholder="t('agent.create.generator.placeholder')"
            rows="8"
            required 
          />
        </div>
        
        <div class="form-field">
          <label for="model">{{ t('agent.create.generator.model') }}</label>
          <div class="help">{{ t('agent.create.generator.help.model') }}</div>
          <EngineModelSelect 
            :engine="selectedEngine" 
            :model="selectedModel"
            :position="'above'"
            :defaultLabel="t('agent.create.generator.modelOptions.auto')"
            @modelSelected="onModelSelected"
          />
        </div>
      </div>

      <!-- Generation in Progress -->
      <div v-if="generating" class="generating-status">
        <div class="loader"><Loader /><Loader /><Loader /></div>
        <div class="generating-text">
          <strong>{{ t('agent.create.generator.generating.title') }}</strong>
          <p>{{ t('agent.create.generator.generating.subtitle') }}</p>
        </div>
      </div>

      <!-- Generated Preview -->
      <div class="preview" v-if="generatedAgent && !generating">
        
        <div class="preview-success">
          <div class="success-icon">✨</div>
          <h3>{{ t('agent.create.generator.success.title') }}</h3>
          <p>{{ t('agent.create.generator.success.subtitle') }}</p>
        </div>
        
        <div class="preview-card">
          <div class="preview-header">
            <h4>{{ generatedAgent.name }}</h4>
            <p>{{ generatedAgent.instructions }}</p>
          </div>
          <div class="preview-body">
            <div class="preview-section">
              <strong>{{ t('agent.create.generator.preview.steps') }} ({{ generatedAgent.steps.length }}):</strong>
              <ul>
                <li v-for="(step, index) in generatedAgent.steps" :key="index">
                  {{ step.description || `Step ${index + 1}` }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      
      </div>
    
    </template>
    
    <template #buttons>

      <button name="skip" @click="skipGeneration" class="secondary">{{ t('agent.create.generator.skip') }}</button>

      <template v-if="!generatedAgent && !generating">
        <button name="generate" @click="generateAgent" class="primary">{{ t('agent.create.generator.generate') }}</button>
      </template>

      <template v-if="generatedAgent && !generating">
        <button name="tryAgain" @click="tryAgain" class="secondary">{{ t('agent.create.generator.tryAgain') }}</button>
        <button name="review" @click="onNext" class="primary">{{ t('agent.create.generator.review') }}</button>
      </template>

    </template>
  
  </WizardStep>
</template>

<script setup lang="ts">
import { computed, onMounted, PropType, ref } from 'vue'
import EngineModelSelect from '../components/EngineModelSelect.vue'
import WizardStep from '../components/WizardStep.vue'
import LlmFactory from '../llms/llm'
import Agent from '../models/agent'
import AgentGenerator from '../services/agent_generator'
import VoiceTextarea from '../components/VoiceTextarea.vue'
import Loader from '../components/Loader.vue'
import { t } from '../services/i18n'
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
  prevButtonText: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['prev', 'next', 'error'])

const description = ref('')
const selectedEngine = ref('')
const selectedModel = ref('')
const generating = ref(false)
const generatedAgent = ref<Agent | null>(null)

const llmManager = LlmFactory.manager(store.config)

const nextButtonText = computed(() => {
  if (generatedAgent.value) return t('agent.create.generator.review')
  else return t('agent.create.generator.generate')
})

const reset = () => {
  description.value = ''
  selectedEngine.value = ''
  selectedModel.value = ''
  generating.value = false
  generatedAgent.value = null
}

onMounted(() => {
  reset()
  // Set default engine/model for display
  const engines = llmManager.getChatEngines()
  if (engines.length > 0) {
    const defaultEngine = engines[0]
    selectedEngine.value = defaultEngine
    selectedModel.value = llmManager.getDefaultChatModel(defaultEngine)
  }
})

const onModelSelected = (engine: string | null, model: string | null) => {
  selectedEngine.value = engine || ''
  selectedModel.value = model || ''
}

const generateAgent = async () => {
  if (!description.value.trim()) {
    emit('error', t('agent.create.generator.error.description'))
    return
  } else {
    emit('error', '')
  }

  generating.value = true
  
  try {
    const generator = new AgentGenerator(store.config)
    const agent = await generator.generateAgentFromDescription(
      description.value.trim(),
      selectedEngine.value || undefined,
      selectedModel.value || undefined
    )

    if (agent) {
      generatedAgent.value = agent
      // Don't apply config yet - let user review first
    } else {
      emit('error', t('agent.create.generator.error.generation'))
    }
  } catch (error) {
    console.error('Agent generation failed:', error)
    emit('error', t('agent.create.generator.error.unexpected'))
  } finally {
    generating.value = false
  }
}

const tryAgain = () => {
  generatedAgent.value = null
  generating.value = false
}

const skipGeneration = () => {
  generatedAgent.value = null
  emit('next')
}

const applyGeneratedConfig = (agent: Agent) => {
  props.agent.name = agent.name
  props.agent.description = agent.description
  props.agent.type = agent.type
  props.agent.instructions = agent.instructions
  props.agent.schedule = agent.schedule
  props.agent.steps = agent.steps
}

const onNext = () => {
  if (generatedAgent.value) {
    applyGeneratedConfig(generatedAgent.value)
    emit('next')
  } else if (generating.value) {
    return
  } else {
    generateAgent()
  }
}

const validate = (): string|null => {
  return null
}

defineExpose({
  reset, validate
})

</script>

<style scoped>

.engine-model-select {
  width: calc(100% - 2rem);
}

.generating-status {
  margin: 2rem 8rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
}

.loader {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.generating-text {
  font-size: 12pt;
}

.generating-text strong {
  color: var(--text-color);
}

.generating-text p {
  margin: 0.5rem 0 0 0;
  color: var(--faded-text-color);
}

.preview-success {
  text-align: center;
  margin-bottom: 2rem;
}

.success-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.preview-success h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
}

.preview-success p {
  margin: 0;
  color: var(--faded-text-color);
}

.preview-card {
  border: 1px solid var(--sidebar-border-color);
  border-radius: 8px;
  padding: 1rem;
  background-color: var(--background-color-secondary);
}

.preview-header h4 {
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
}

.preview-header p {
  margin: 0 0 1rem 0;
  color: var(--faded-text-color);
  font-style: italic;
}

.preview-section {
  margin-bottom: 1rem;
}

.preview-section ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.preview-section li {
  margin-bottom: 0.5rem;
}

.tools-list {
  color: var(--faded-text-color);
  font-size: 0.9em;
}

textarea {
  min-height: 8lh;
  resize: vertical;
}

.form-field select {
  margin-bottom: 0.5rem;
}

</style>