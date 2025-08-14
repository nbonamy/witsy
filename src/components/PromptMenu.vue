<template>
  <ContextMenuPlus 
    :anchor="anchor"
    :position="position"
    :teleport="teleport"
    :show-filter="false"
    @close="$emit('close')"
  >
    <!-- Main menu template -->
    <template #default>

      <div v-if="enableExperts && expertsMenuItems.length > 0" class="experts" data-submenu-slot="expertsSubmenu" >
        <BIconMortarboard class="icon" /> {{ t('prompt.menu.experts.title') }}
      </div>
      
      <div v-if="enableDocRepo" class="docrepos" data-submenu-slot="docReposSubmenu" >
        <BIconLightbulb class="icon" /> {{ t('prompt.menu.docRepos.title') }}
      </div>
      
      <div v-if="enableInstructions" class="instructions" data-submenu-slot="instructionsSubmenu" >
        <BIconFeather class="icon" /> {{ t('prompt.menu.instructions.title') }}
      </div>
      
      <div v-if="enableDeepResearch" class="deepresearch" @click="handleDeepResearchClick" >
        <BIconBinoculars class="icon" /> {{ t('prompt.menu.deepResearch.title') || 'Deep Research' }}
      </div>

      <div v-if="enableAttachments && (enableExperts || enableDocRepo || enableInstructions)" class="separator" >
        <hr>
      </div>
      
      <div v-if="enableAttachments" class="attachments" @click="handleAttachmentClick" >
        <BIconPaperclip class="icon" /> {{ t('prompt.menu.attach.title') }}
      </div>
      
    </template>

    <template #expertsSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div v-for="expert in expertsMenuItems" :key="expert.id" @click="handleExpertClick(expert.id)" >
        {{ expert.name }}
      </div>
    </template>

    <template #expertsSubmenuFooter>
      <div @click="handleManageExperts">
        <BIconPlusLg class="icon" /> {{ t('prompt.menu.experts.manage') }}
      </div>
    </template>

    <template #docReposSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div v-for="docRepo in docReposMenuItems" :key="docRepo.uuid" @click="handleDocRepoClick(docRepo.uuid)" >
        <BIconDatabase class="icon" /> {{ docRepo.name }}
      </div>
    </template>

    <template #docReposSubmenuFooter>
      <div @click="handleManageDocRepo">
        <BIconGear class="icon" /> {{ t('prompt.menu.docRepos.manage') }}
      </div>
    </template>

    <template #instructionsSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div @click="handleInstructionsClick('null')" >
        {{ t('prompt.instructions.default') }}
      </div>
      <div v-for="instructionId in instructionIds" :key="instructionId" @click="handleInstructionsClick(instructionId)" >
        {{ t(`settings.llm.instructions.${instructionId}`) }}
      </div>
      <div v-for="custom in customInstructions" :key="custom.id" @click="handleInstructionsClick(`custom:${custom.id}`)" >
        {{ custom.label }}
      </div>
    </template>
  </ContextMenuPlus>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ContextMenuPlus from './ContextMenuPlus.vue'
import { store } from '../services/store'
import { t, expertI18n } from '../services/i18n'
import { DocumentBase } from '../types/rag'
import { Expert } from '../types/index'
import { BIconLightbulb, BIconPlusLg, BIconDatabase, BIconGear, BIconMortarboard, BIconFeather, BIconBinoculars, BIconPaperclip } from 'bootstrap-icons-vue'

// Props
interface Props {
  anchor: string
  position?: 'below' | 'above' | 'right' | 'left' | 'above-right' | 'above-left' | 'below-right' | 'below-left'
  teleport?: boolean
  enableExperts?: boolean
  enableDocRepo?: boolean
  enableInstructions?: boolean
  enableAttachments?: boolean
  enableDeepResearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  position: 'below',
  teleport: true,
  enableExperts: true,
  enableDocRepo: true,
  enableInstructions: true,
  enableAttachments: true,
  enableDeepResearch: true,
})

// Emits
interface Emits {
  close: []
  expertSelected: [expertId: string]
  manageExperts: []
  docRepoSelected: [docRepoUuid: string]
  manageDocRepo: []
  instructionsSelected: [instructionId: string]
  attachRequested: []
  deepResearchToggled: []
}

const emit = defineEmits<Emits>()

// Reactive data
const docRepos = ref<DocumentBase[]>([])

// Built-in instruction IDs
const instructionIds = ['standard', 'structured', 'playful', 'empathic', 'uplifting', 'reflective', 'visionary']

// Computed properties
const expertsMenuItems = computed(() => {
  return store.experts
    .filter((expert: Expert) => expert.state === 'enabled')
    .map(expert => ({
      id: expert.id,
      name: expert.name || expertI18n(expert, 'name'),
      prompt: expert.prompt || expertI18n(expert, 'prompt')
    }))
})

const docReposMenuItems = computed(() => {
  return docRepos.value.map(docRepo => ({
    uuid: docRepo.uuid,
    name: docRepo.name,
    description: (docRepo as any).description || ''
  }))
})

const customInstructions = computed(() => {
  return store.config.llm.customInstructions || []
})

// Methods
const loadDocRepos = () => {
  if (props.enableDocRepo) {
    try {
      docRepos.value = window.api?.docrepo?.list(store.config.workspaceId) || []
    } catch (error) {
      console.error('Failed to load document repositories:', error)
      docRepos.value = []
    }
  }
}

const handleExpertClick = (expertId: string) => {
  emit('close')
  emit('expertSelected', expertId)
}

const handleManageExperts = () => {
  emit('close')
  emit('manageExperts')
}

const handleDocRepoClick = (docRepoUuid: string) => {
  emit('close')
  emit('docRepoSelected', docRepoUuid)
}

const handleManageDocRepo = () => {
  emit('close')
  emit('manageDocRepo')
}

const handleInstructionsClick = (instructionId: string) => {
  emit('instructionsSelected', instructionId)
  emit('close')
}

const handleAttachmentClick = () => {
  emit('attachRequested')
}

const handleDeepResearchClick = () => {
  emit('deepResearchToggled')
  emit('close')
}


// Lifecycle
onMounted(() => {
  loadDocRepos()
  
  // Listen for doc repo changes if available
  if (window.api?.on) {
    window.api.on('docrepo-modified', loadDocRepos)
  }
})
</script>

