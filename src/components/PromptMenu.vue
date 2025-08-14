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
      <!-- Experts -->
      <div 
        v-if="enableExperts && expertsMenuItems.length > 0" 
        class="item experts" 
        data-submenu-slot="expertsSubmenu"
      >
        <BIconMortarboard class="icon" />
        {{ t('prompt.experts.title') }}
      </div>
      
      <!-- Knowledge Documents -->
      <div 
        v-if="enableDocRepo" 
        class="item docrepos" 
        data-submenu-slot="docReposSubmenu"
      >
        <BIconDatabase class="icon" />
        {{ t('prompt.docRepos.title') }}
      </div>
      
      <!-- Writing Style -->
      <div 
        v-if="enableInstructions" 
        class="item instructions" 
        data-submenu-slot="instructionsSubmenu"
      >
        <BIconTerminal class="icon" />
        {{ t('prompt.instructions.title') }}
      </div>
      
      <!-- Deep Research -->
      <div 
        v-if="enableDeepResearch" 
        class="item deepresearch" 
        @click="handleDeepResearchClick"
      >
        <BIconBinoculars class="icon" />
        {{ t('common.deepResearch') || 'Deep Research' }}
      </div>

      <!-- Separator -->
      <div 
        v-if="enableAttachments && (enableExperts || enableDocRepo || enableInstructions)" 
        class="item separator"
      >
        <hr>
      </div>
      
      <!-- Add Photo & Files -->
      <div 
        v-if="enableAttachments" 
        class="item attachments" 
        @click="handleAttachmentClick"
      >
        <BIconPaperclip class="icon" />
        {{ t('prompt.attachment.tooltip') || 'Add Photo & Files' }}
      </div>
      
    </template>

    <!-- Experts submenu -->
    <template #expertsSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div 
        v-for="expert in expertsMenuItems" 
        :key="expert.id"
        class="item"
        @click="handleExpertClick(expert.id)"
      >
        <!-- <BIconStars class="icon" /> -->
        {{ expert.name }}
      </div>
      
      <div v-if="expertsMenuItems.length === 0" class="item disabled">
        {{ t('prompt.experts.none') || 'No experts available' }}
      </div>
    </template>

    <!-- Knowledge Documents submenu -->
    <template #docReposSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <div 
        v-for="docRepo in docReposMenuItems" 
        :key="docRepo.uuid"
        class="item"
        @click="handleDocRepoClick(docRepo.uuid)"
      >
        <BIconDatabase class="icon" />
        {{ docRepo.name }}
      </div>
      
      <!-- Manage Knowledge Base option -->
      <template v-if="docReposMenuItems.length > 0">
        <div class="item separator"><hr></div>
      </template>
      <div class="item" @click="handleManageDocRepo">
        <BIconGear class="icon" />
        {{ t('prompt.docRepos.manage') || 'Manage Knowledge Base' }}
      </div>
    </template>

    <!-- Writing Style (Instructions) submenu -->
    <template #instructionsSubmenu="{ withFilter }">
      {{ withFilter(true) }}
      <!-- Default option -->
      <div 
        class="item"
        @click="handleInstructionsClick('null')"
      >
        {{ t('prompt.instructions.default') || 'Default' }}
      </div>
      
      <!-- Built-in instruction styles -->
      <div 
        v-for="instructionId in instructionIds" 
        :key="instructionId"
        class="item"
        @click="handleInstructionsClick(instructionId)"
      >
        {{ t(`settings.llm.instructions.${instructionId}`) || instructionId }}
      </div>
      
      <!-- Custom instructions -->
      <div 
        v-for="custom in customInstructions" 
        :key="custom.id"
        class="item"
        @click="handleInstructionsClick(`custom:${custom.id}`)"
      >
        <BIconPersonFill class="icon" />
        {{ custom.label }}
        <div class="description">{{ truncateText(custom.instructions, 100) }}</div>
      </div>
    </template>
  </ContextMenuPlus>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { 
  BIconMortarboard, 
  BIconDatabase, 
  BIconTerminal, 
  BIconPaperclip,
  BIconBinoculars,
  BIconPersonFill,
  BIconGear
} from 'bootstrap-icons-vue'
import ContextMenuPlus from './ContextMenuPlus.vue'
import { store } from '../services/store'
import { t, expertI18n } from '../services/i18n'
import { DocumentBase } from '../types/rag'
import { Expert } from '../types/index'

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
  workspaceId?: string
  engine?: string
  model?: string
}

const props = withDefaults(defineProps<Props>(), {
  position: 'below',
  teleport: true,
  enableExperts: true,
  enableDocRepo: true,
  enableInstructions: true,
  enableAttachments: true,
  enableDeepResearch: true,
  currentExpert: null,
  activeDocRepo: null,
  currentInstructions: null,
  deepResearchActive: false
})

// Emits
interface Emits {
  close: []
  expertSelected: [expertId: string]
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
      docRepos.value = window.api?.docrepo?.list(props.workspaceId || store.config.workspaceId) || []
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

const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
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

