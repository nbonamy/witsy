<template>

  <section>

    <header>
      <h1>{{ t('onboarding.ollama.title') }}</h1>
      <h3>{{ t('onboarding.ollama.subtitle') }}</h3>
    </header>

    <div class="form form-large">
      
      <!-- Checking Ollama installation -->
      <div v-if="status === 'checking'" class="status-section">
        <EngineLogo engine="ollama" class="ollama-logo animated" :grayscale="true" />
        <p class="section-status">{{ t('onboarding.ollama.checking') }}</p>
      </div>

      <!-- Ollama not installed -->
      <div v-else-if="status === 'not-installed'" class="status-section">
        <EngineLogo engine="ollama" class="ollama-logo" :class="{ animated: downloading}" />
        <div class="install-prompt">
            
          <p class="section-status">{{ t(downloading ? 'onboarding.ollama.downloading' : 'onboarding.ollama.notInstalled') }}</p>
          
          <div class="form-field">
            
            <!-- Download/Check buttons-->
            <template v-if="!downloading">
              <button @click="downloadOllama" class="default">
                {{ t('onboarding.ollama.download') }}
              </button>
              <button @click="checkOllamaStatus">
                {{ t('onboarding.ollama.checkAgain') }}
              </button>
            </template>

            <!-- Download progress -->
            <template v-else>
              <div class="progress-section">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: downloadProgress + '%' }"></div>
                </div>
                <button @click="cancelDownload" :disabled="cancelling">
                  {{ cancelling ? t('onboarding.ollama.cancelling') : t('common.cancel') }}
                </button>
              </div>
            </template>

          </div>
        </div>
        
      </div>

      <!-- Ollama installed - show models and pull interface -->
      <div v-else-if="status === 'installed'" class="ollama-content">
        
        <!-- Installed models -->
        <div class="models-section">
          <h4 class="section-title">
            <BIconCpu class="section-icon" />
            {{ t('onboarding.ollama.installedModels') }}
          </h4>
          <div class="models-list" v-if="installedModels.length > 0">
            <div v-for="model in installedModels" :key="model.id" class="model-card">
              <div class="model-info">
                <span class="model-name">{{ model.name }}</span>
              </div>
              <div class="model-capabilities">
                <BIconTools :class="{ active: model.capabilities?.tools }" class="capability" />
                <BIconImage :class="{ active: model.capabilities?.vision }" class="capability" />
                <BIconLightningChargeFill :class="{ active: model.capabilities?.reasoning }" class="capability" />
              </div>
            </div>
          </div>
          <div v-else class="section-status">
            {{ t('onboarding.ollama.noModelsInstalled') }}
          </div>
        </div>

        <!-- Model pulling interface -->
        <div class="pull-section">
          <h4 class="section-title">
            <BIconDownload class="section-icon" />
            {{ t('onboarding.ollama.pullModels') }}
          </h4>
          <OllamaModelPull 
            :pullable-models="getChatModels()" 
            info-url="https://ollama.com/search" 
            :info-text="t('onboarding.ollama.browseModels')"
            @done="loadInstalledModels" 
          />
        </div>

      </div>

      <!-- Error state -->
      <div v-else-if="status === 'error'" class="status-section error">
        <EngineLogo engine="ollama" class="ollama-logo" />
        <div class="error-prompt">
          <p>{{ errorMessage }}</p>
          <button @click="checkOllamaStatus">
            {{ t('onboarding.ollama.retry') }}
          </button>
        </div>
      </div>

    </div>

  </section>

</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { Ollama, } from 'ollama/dist/browser.cjs'
import LlmManager from '../llms/manager'
import OllamaModelPull from '../components/OllamaModelPull.vue'
import EngineLogo from '../components/EngineLogo.vue'
import Dialog from '../composables/dialog'
import { getChatModels } from '../llms/ollama'
import type { ChatModel } from 'multi-llm-ts'
import * as IPC from '../ipc_consts'

declare const window: {
  api: {
    on: (channel: string, callback: (...args: any[]) => void) => void
    off: (channel: string, callback: (...args: any[]) => void) => void
    file: {
      pickDir: () => string
      openInExplorer: (filePath: string) => { success: boolean; error?: string }
    }
    ollama: {
      downloadStart: (targetDirectory: string) => Promise<{ success: boolean; downloadId?: string; error?: string }>
      downloadCancel: () => Promise<{ success: boolean }>
    }
  }
}

const status = ref<'checking' | 'not-installed' | 'installed' | 'error'>('checking')
const downloading = ref(false)
const cancelling = ref(false)
const downloadProgress = ref(0)
const installedModels = ref<ChatModel[]>([])
const errorMessage = ref('')
const currentDownloadId = ref<string | null>(null)
const downloadedFilePath = ref<string | null>(null)

const llmManager = new LlmManager(store.config)

onMounted(() => {
  checkOllamaStatus()
  setupIpcListeners()
})

onUnmounted(() => {
  removeIpcListeners()
})

// IPC event listeners
const onDownloadProgress = (event: any) => {
  const { progress } = event
  downloadProgress.value = progress
}

const onDownloadComplete = async (event: any) => {
  
  const { downloadId, filePath } = event
  if (downloadId === currentDownloadId.value) {
    downloading.value = false
    currentDownloadId.value = null
    downloadedFilePath.value = filePath
    
    // Show dialog with option to open file location
    const result = await Dialog.show({
      title: t('onboarding.ollama.downloadComplete'),
      text: t('onboarding.ollama.downloadCompleteMessage'),
      showCancelButton: true,
      confirmButtonText: t('onboarding.ollama.openFolder'),
      cancelButtonText: t('common.close')
    })
    
    if (result.isConfirmed && downloadedFilePath.value) {
      window.api.file.openInExplorer(downloadedFilePath.value)
    }
  }
}

const onDownloadError = (event: any) => {
  downloading.value = false
  cancelling.value = false
  status.value = 'error'
  errorMessage.value = t('onboarding.ollama.downloadError')
  currentDownloadId.value = null
}

const setupIpcListeners = () => {
  window.api.on(IPC.OLLAMA.DOWNLOAD_PROGRESS, onDownloadProgress)
  window.api.on(IPC.OLLAMA.DOWNLOAD_COMPLETE, onDownloadComplete)
  window.api.on(IPC.OLLAMA.DOWNLOAD_ERROR, onDownloadError)
}

const removeIpcListeners = () => {
  window.api.off(IPC.OLLAMA.DOWNLOAD_PROGRESS, onDownloadProgress)
  window.api.off(IPC.OLLAMA.DOWNLOAD_COMPLETE, onDownloadComplete)
  window.api.off(IPC.OLLAMA.DOWNLOAD_ERROR, onDownloadError)
}

const checkOllamaStatus = () => {

  status.value = 'checking'

  setTimeout(async () => {

    try {

      const client = new Ollama({
        host: store.config.engines.ollama.baseURL,
      })

      await client.ps()
      await loadInstalledModels()
      status.value = 'installed'

    } catch (error) {
      status.value = 'not-installed'
    }

  }, 500)

}

const loadInstalledModels = async () => {
  await llmManager.loadModels('ollama')
  installedModels.value = store.config.engines.ollama.models.chat || []
}

const downloadOllama = async () => {
  try {
    // First, let user pick a directory to download to
    const targetDirectory = await window.api.file.pickDir()
    if (!targetDirectory) {
      return // User cancelled directory selection
    }
    
    downloading.value = true
    downloadProgress.value = 0
    
    const result = await window.api.ollama.downloadStart(targetDirectory)
    
    if (result.success) {
      currentDownloadId.value = result.downloadId || null
    } else {
      throw new Error(result.error)
    }
    
  } catch (error) {
    downloading.value = false
    status.value = 'error'
    errorMessage.value = t('onboarding.ollama.downloadError')
    currentDownloadId.value = null
  }
}

const cancelDownload = async () => {
  if (currentDownloadId.value && !cancelling.value) {
    try {
      cancelling.value = true
      await window.api.ollama.downloadCancel()
      downloading.value = false
      cancelling.value = false
      currentDownloadId.value = null
    } catch (error) {
      console.error('Failed to cancel download:', error)
      cancelling.value = false
    }
  }
}

</script>


<style scoped>

.status-section {
  
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  
  .ollama-logo {
    width: 4rem;
    height: 4rem;
    opacity: 0.9;
    margin-bottom: 0.5rem;

    &.animated {
      animation: logoFloat 3s ease-in-out infinite;
    }
  }
  
  .section-status {
    font-size: 1.125rem;
    margin: 1rem 0;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}

@keyframes logoFloat {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
}

.install-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  
  .form-field {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .download-status {
    font-size: 0.95rem;
    color: var(--dimmed-text-color);
  }
}

.error-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  
  p {
    font-size: 1.125rem;
    text-align: center;
  }
}

.progress-section {
  width: 300px;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: var(--window-bg-color);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 2rem;
}

.progress-fill {
  height: 100%;
  background-color: var(--highlight-color);
  transition: width 0.3s ease;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.ollama-content {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.models-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-color);
    
    .section-icon {
      width: 1.25rem;
      height: 1.25rem;
      color: var(--accent-color);
      opacity: 0.8;
    }
  }
}

.models-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.model-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background-color: var(--background-color);
  border-radius: 0.5rem;
  border: 1px solid var(--control-border-color);
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
}

.model-name {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-id {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--dimmed-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-capabilities {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
  margin-left: 0.75rem;
}

.capability {
  width: 0.875rem;
  height: 0.875rem;
  opacity: 0.2;
  transition: opacity 0.2s ease;
  
  &.active {
    opacity: 0.7;
  }
}

.pull-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-color);
    
    .section-icon {
      width: 1.25rem;
      height: 1.25rem;
      color: var(---color);
      opacity: 0.8;
    }
  }
  
  :deep(label) {
    display: none;
  }
}

.error {
  color: var(--error-color);
}

</style>
