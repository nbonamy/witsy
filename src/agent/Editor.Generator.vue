<template>
  <WizardStep :visible="visible" :prev-button-text="prevButtonText" :error="error" @prev="$emit('prev')" @next="onNext">
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
          <textarea 
            v-model="description" 
            name="description" 
            :placeholder="t('agent.create.generator.placeholder')"
            rows="8"
            required 
          ></textarea>
        </div>
        
        <div class="form-field">
          <label for="model">{{ t('agent.create.generator.model') }}</label>
          <div class="help">{{ t('agent.create.generator.help.model') }}</div>
          <EngineSelect 
            v-model="selectedEngine" 
            :default-text="t('agent.create.generator.modelOptions.auto')"
            @change="onEngineChange"
          />
          <ModelSelect 
            v-if="selectedEngine" 
            v-model="selectedModel" 
            :engine="selectedEngine"
          />
        </div>
      </div>

      <!-- Generation in Progress -->
      <div v-if="generating" class="form-field generating-status">
        <div class="generating-indicator">
          <div class="spinner"></div>
          <div class="generating-text">
            <strong>{{ t('agent.create.generator.generating.title') }}</strong>
            <p>{{ t('agent.create.generator.generating.subtitle') }}</p>
          </div>
        </div>
      </div>

      <!-- Generated Preview (replace input fields when generated) -->
      <div v-if="generatedAgent && !generating">
        <div class="preview-success">
          <div class="success-icon">✨</div>
          <h3>{{ t('agent.create.generator.success.title') }}</h3>
          <p>{{ t('agent.create.generator.success.subtitle') }}</p>
        </div>
        
        <div class="preview-card">
          <div class="preview-header">
            <h4>{{ generatedAgent.name }}</h4>
            <p>{{ generatedAgent.description }}</p>
          </div>
          <div class="preview-body">
            <div class="preview-section">
              <strong>{{ t('agent.create.generator.preview.steps') }} ({{ generatedAgent.steps.length }}):</strong>
              <ul>
                <li v-for="(step, index) in generatedAgent.steps" :key="index">
                  <strong>{{ step.description || `Step ${index + 1}` }}</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #buttons>
      <button 
        v-if="!generatedAgent && !generating"
        @click="skipGeneration" 
        class="secondary"
      >
        {{ t('agent.create.generator.skip') }}
      </button>
      <button 
        v-if="generatedAgent && !generating"
        @click="tryAgain" 
        class="secondary"
      >
        {{ t('agent.create.generator.tryAgain') }}
      </button>
    </template>
  </WizardStep>
</template>

<script setup lang="ts">
import { onMounted, PropType, ref } from 'vue'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import WizardStep from '../components/WizardStep.vue'
import LlmFactory from '../llms/llm'
import Agent from '../models/agent'
import AgentGenerator from '../services/agent_generator'
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

const emit = defineEmits(['prev', 'next'])

const description = ref('')
const selectedEngine = ref('')
const selectedModel = ref('')
const generating = ref(false)
const generatedAgent = ref<Agent | null>(null)

const llmManager = LlmFactory.manager(store.config)

onMounted(() => {
  // Reset state when component mounts - start fresh each time
  description.value = ''
  selectedEngine.value = ''
  selectedModel.value = ''
  generatedAgent.value = null
})

const onEngineChange = () => {
  if (selectedEngine.value) {
    selectedModel.value = llmManager.getDefaultChatModel(selectedEngine.value)
  } else {
    selectedModel.value = ''
  }
}

const generateAgent = async () => {
  if (!description.value.trim()) {
    emit('next', { error: t('agent.create.generator.error.description') })
    return
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
      emit('next', { error: t('agent.create.generator.error.generation') })
    }
  } catch (error) {
    console.error('Agent generation failed:', error)
    emit('next', { error: t('agent.create.generator.error.unexpected') })
  } finally {
    generating.value = false
  }
}

const tryAgain = () => {
  // Reset to initial state but keep user inputs
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
  props.agent.steps = agent.steps
}

const onNext = () => {
  if (generatedAgent.value) {
    // Apply generated config and proceed to next step
    applyGeneratedConfig(generatedAgent.value)
    emit('next')
  } else if (generating.value) {
    // Do nothing while generating
    return
  } else {
    // Generate the agent and stay on this step to show preview
    generateAgent()
  }
}
</script>

<style scoped>
.generating-status {
  margin-top: 2rem;
  text-align: center;
}

.generating-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--faded-text-color);
  border-top: 2px solid var(--text-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.generating-text {
  text-align: left;
}

.generating-text strong {
  color: var(--text-color);
}

.generating-text p {
  margin: 0.5rem 0 0 0;
  color: var(--faded-text-color);
  font-size: 0.9em;
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