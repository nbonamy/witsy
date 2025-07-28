<template>
  <div class="tab-content" @keyup.escape.prevent="onEditInstruction(null)">
    <header v-if="selectedInstruction">
      <BIconChevronLeft class="icon back" @click="onEditInstruction(null)" />
      <div class="title">{{ t('settings.llm.instructions.editor.title') }}</div>
    </header>
    <header v-else>
      <div class="title">{{ t('settings.tabs.llm') }}</div>
    </header>
    <main class="sliding-root form form-vertical form-large" :class="{ visible: !selectedInstruction }">
      <div class="form-field chat-prompt">
        <label>{{ t('settings.llm.instructions.label') }}</label>
        <select v-model="instructions" @change="save">
          <option value="standard">{{ t('settings.llm.instructions.standard') }}</option>
          <option value="structured">{{ t('settings.llm.instructions.structured') }}</option>
          <option value="playful">{{ t('settings.llm.instructions.playful') }}</option>
          <option value="empathic">{{ t('settings.llm.instructions.empathic') }}</option>
          <option value="uplifting">{{ t('settings.llm.instructions.uplifting') }}</option>
          <option value="reflective">{{ t('settings.llm.instructions.reflective') }}</option>
          <option value="visionary">{{ t('settings.llm.instructions.visionary') }}</option>
          <option v-for="custom in customInstructions" :key="custom.id" :value="custom.id">{{ custom.label }}</option>
        </select>
        <div class="actions">
          <button type="button" @click="onCreateInstruction">{{ t('common.add') }}</button>
          <button type="button" @click="onEditCurrentInstruction()">{{ t('common.edit') }}</button>
          <button type="button" @click="onDeleteInstruction" :disabled="!isCustomInstructionSelected">{{ t('common.delete') }}</button>
        </div>
      </div>
      <div class="form-field quick-prompt">
        <label>{{ t('settings.general.promptLLMModel') }}</label>
        <EngineSelect class="engine" v-model="engine" @change="onChangeEngine" :default-text="t('settings.general.lastOneUsed')" />
        <ModelSelectPlus class="model" v-model="model" @change="onChangeModel" :engine="engine" :default-text="!models.length ? t('settings.general.lastOneUsed') : ''" />
      </div>
      <div class="form-field localeLLM">
        <label>{{ t('settings.general.localeLLM') }}</label>
        <div class="form-subgroup">
          <LangSelect v-model="localeLLM" @change="onChangeLocaleLLM" />
          <div class="form-field horizontal">
            <input type="checkbox" v-model="forceLocale" :disabled="!isLocalized" @change="save" />
            <div class="label">{{ t('settings.general.forceLocale') }}</div>
          </div>
        </div>
      </div>
      <div class="form-field length">
        <label>{{ t('settings.advanced.conversationLength') }}</label>
        <input type="number" min="1" v-model="conversationLength" @change="save">
      </div>
    </main>
    <main class="editor sliding-pane" :class="{ visible: selectedInstruction }">
      <InstructionEditor :instruction="selectedInstruction" @cancel="onEditInstruction(null)" @save="onInstructionSaved" />
    </main>
  </div>
</template>

<script setup lang="ts">

import { InstructionsType, CustomInstruction } from '../types/config'
import { ref, computed } from 'vue'
import { store } from '../services/store'
import { hasLocalization, t, i18nInstructions } from '../services/i18n'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelectPlus from '../components/ModelSelectPlus.vue'
import LangSelect from '../components/LangSelect.vue'
import InstructionEditor from '../components/InstructionEditor.vue'
import Dialog from '../composables/dialog'

const isMas = ref(false)
const instructions = ref<InstructionsType>('structured')
const engine = ref(null)
const model = ref(null)
const localeLLM = ref(null)
const isLocalized = ref(false)
const forceLocale = ref(false)
const conversationLength = ref(null)
const customInstructions = ref<CustomInstruction[]>([])
const selectedInstruction = ref<CustomInstruction | null>(null)

const models = computed(() => {
  if (!engine.value || engine.value == '') return []
  if (!store.config.engines[engine.value]) {
    engine.value = ''
    model.value = ''
    save()
    return []
  }
  return store.config.engines[engine.value].models.chat
})

const isCustomInstructionSelected = computed(() => {
  const defaultInstructions = ['standard', 'structured', 'playful', 'empathic', 'uplifting', 'reflective', 'visionary']
  return !defaultInstructions.includes(instructions.value as string)
})

const getDefaultInstructionKey = (instructionType: string) => {
  return `instructions.chat.${instructionType}`
}

const getDefaultInstructionLabel = (instructionType: string) => {
  return t(`settings.llm.instructions.${instructionType}`)
}

const load = () => {
  isMas.value = window.api.isMasBuild
  instructions.value = store.config.llm.instructions || 'structured'
  engine.value = store.config.prompt.engine || ''
  model.value = store.config.prompt.model || ''
  localeLLM.value = store.config.llm.locale
  forceLocale.value = store.config.llm.forceLocale
  conversationLength.value = store.config.llm.conversationLength || 5
  customInstructions.value = store.config.llm.customInstructions || []
  onChangeLocaleLLM()
}

const save = () => {
  store.config.llm.instructions = instructions.value
  store.config.prompt.engine = engine.value
  store.config.prompt.model = model.value
  store.config.llm.locale = localeLLM.value
  store.config.llm.forceLocale = forceLocale.value
  store.config.llm.conversationLength = conversationLength.value
  store.config.llm.customInstructions = customInstructions.value
  store.saveSettings()
}

const onChangeEngine = () => {
  if (engine.value == '') model.value = ''
  else model.value = store.config.engines[engine.value].models.chat?.[0]?.id
  save()
}

const onChangeModel = () => {
  save()
}

const onChangeLocaleLLM = () => {
  save()
  isLocalized.value = hasLocalization(window.api.config.getI18nMessages(), window.api.config.localeLLM())
  if (!isLocalized.value) {
    forceLocale.value = true
    save()
  }
}

const getSelectedCustomInstruction = () => {
  return customInstructions.value.find(ci => ci.id === instructions.value) || null
}

const onCreateInstruction = () => {
  const newInstruction: CustomInstruction = {
    id: Date.now().toString(),
    label: '',
    instructions: ''
  }
  selectedInstruction.value = newInstruction
}

const onEditCurrentInstruction = () => {
  if (isCustomInstructionSelected.value) {
    // Edit custom instruction
    const customInstruction = getSelectedCustomInstruction()
    selectedInstruction.value = customInstruction
  } else {
    // Edit default instruction
    const instructionKey = getDefaultInstructionKey(instructions.value as string)
    const currentInstructions = i18nInstructions(store.config, instructionKey)
    const defaultInstruction: CustomInstruction = {
      id: `default_${instructions.value}`,
      label: getDefaultInstructionLabel(instructions.value as string),
      instructions: currentInstructions || i18nInstructions(null, instructionKey) || ''
    }
    selectedInstruction.value = defaultInstruction
  }
}

const onEditInstruction = (instruction: CustomInstruction | null) => {
  selectedInstruction.value = instruction
}

const onDeleteInstruction = async () => {
  if (!isCustomInstructionSelected.value) return
  
  const result = await Dialog.show({
    title: t('common.confirmation.deleteCustomInstruction'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  })
  
  if (result.isConfirmed) {
    const index = customInstructions.value.findIndex(ci => ci.id === instructions.value)
    if (index >= 0) {
      customInstructions.value.splice(index, 1)
      instructions.value = 'structured'
      save()
    }
  }
}

const onInstructionSaved = (instruction: CustomInstruction) => {
  if (instruction.id.startsWith('default_')) {
    // Saving a default instruction override
    const instructionType = instruction.id.replace('default_', '')
    const instructionKey = getDefaultInstructionKey(instructionType)
    const defaultInstructions = i18nInstructions(null, instructionKey)
    
    // Store the override in config using the same approach as SettingsAdvanced
    instructionKey.split('.').reduce((acc, key, i, arr) => {
      if (i === arr.length - 1) {
        if (instruction.instructions !== defaultInstructions) {
          acc[key] = instruction.instructions
        } else {
          delete acc[key]
        }
      } else if (!acc[key]) {
        acc[key] = {}
      } 
      return acc[key]
    }, store.config as any)
  } else {
    // Saving a custom instruction
    const existingIndex = customInstructions.value.findIndex(ci => ci.id === instruction.id)
    
    if (existingIndex >= 0) {
      customInstructions.value[existingIndex] = instruction
    } else {
      customInstructions.value.push(instruction)
    }
    
    instructions.value = instruction.id
  }
  
  selectedInstruction.value = null
  save()
}

defineExpose({ load })

</script>

<style scoped>

.localeLLM div.checkbox {
  display: flex;
  align-items: start;
  margin-top: 8px;
  gap: 6px;
}

.localeLLM div.checkbox input[type="checkbox"] {
  flex-basis: 25px;
  margin-left: 0px;
}

.localeLLM div.checkbox div.label {
  margin-top: 2px;
}

</style>