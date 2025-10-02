<template>
  <main v-if="selectedRepo">
    <div class="info panel collapsed">
      <div class="panel-header" @click="togglePanel">
        <label>{{ t('embedding.model') }}</label>
        <div class="icon"><ChevronDownIcon /></div>
      </div>
      <div class="panel-body">
        <div class="embeddings">
          <div class="info">
            <EngineLogo class="engine" :engine="selectedRepo.embeddingEngine" />
            <span class="model">{{ selectedRepo.embeddingModel }}</span>
          </div>
          <CircleAlertIcon
            class="warning" 
            v-if="!modelReady" 
            v-tooltip="{ text: t('docRepo.view.tooltips.embeddingNotReady'), position: 'right' }"
          />
        </div>
      </div>
    </div>
    <Files v-if="selectedRepo" :selectedRepo="selectedRepo" />
    <Web v-if="selectedRepo" :selectedRepo="selectedRepo" />
    <Notes v-if="selectedRepo" :selectedRepo="selectedRepo" />
  </main>
</template>

<script setup lang="ts">
import { ChevronDownIcon, CircleAlertIcon } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import EngineLogo from '../components/EngineLogo.vue'
import { togglePanel } from '../composables/panel'
import { t } from '../services/i18n'
import { DocumentBase } from '../types/rag'
import Files from './Files.vue'
import Notes from './Notes.vue'
import Web from './Web.vue'

// props
const props = defineProps<{
  selectedRepo: DocumentBase | null
}>()

// internal state
const modelReady = ref(true)

const updateModelReady = () => {
  if (props.selectedRepo) {
    modelReady.value = window.api.docrepo.isEmbeddingAvailable(
      props.selectedRepo.embeddingEngine, 
      props.selectedRepo.embeddingModel
    )
  }
}

const onModelReady = () => {
  updateModelReady()
}

onMounted(() => {
  window.api.on('docrepo-model-downloaded', onModelReady)
})

onUnmounted(() => {
  window.api.off('docrepo-model-downloaded', onModelReady)
})

// Watch for changes to selectedRepo to update modelReady
watch(() => props.selectedRepo, () => {
  updateModelReady()
}, { immediate: true })
</script>

<style scoped>

main {
  overflow: hidden;
  height: 100%;
  gap: 1rem;
  padding: 1.5rem;
}

.info {

  .panel-body {

    gap: 0.25rem;

    .embeddings {

      align-self: flex-start;
      
      .info {
        
        border: 1px solid var(--control-border-color);
        background-color: var(--control-disabled-bg-color);
        border-radius: 0.5rem;
        padding: 0.75rem 1.25rem;

        display: flex;
        align-items: center;
        gap: 0.75rem;

        .engine {
          width: var(--icon-lg);
          height: var(--icon-lg);
        }

        .model {
          font-size: 15.5px;
          color: var(--faded-text-color);
        }
      }

      .warning {
        color: red;
        margin-left: 4px;
      }

    }

  }

}

</style>
