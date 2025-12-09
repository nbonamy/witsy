<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.favorites') }}</div>
      <div class="actions">
        <button name="add" class="large primary" @click="showAddFavoriteModal">
          <PlusIcon />{{ t('settings.favorites.add') }}
        </button>
      </div>
    </header>
    <main>
      <table class="table-plain" v-if="favorites.length > 0">
        <thead>
          <tr>
            <th>{{ t('common.llmProvider') }}</th>
            <th>{{ t('common.llmModel') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(favorite, index) in favorites" :key="favorite.id">
            <td>
              <div class="engine-cell">
                <EngineLogo :engine="favorite.engine" :grayscale="false" />
                {{ getEngineName(favorite.engine) }}
              </div>
            </td>
            <td>{{ getModelName(favorite.engine, favorite.model) }}</td>
            <td>
              <div class="actions">
                <ButtonIcon
                  :disabled="index === favorites.length - 1"
                  v-tooltip="{ text: t('settings.favorites.moveDown'), position: 'top-left' }"
                  @click="moveDown(index)"
                ><ChevronDownIcon /></ButtonIcon>
                <ButtonIcon
                  :disabled="index === 0"
                  v-tooltip="{ text: t('settings.favorites.moveUp'), position: 'top-left' }"
                  @click="moveUp(index)"
                ><ChevronUpIcon /></ButtonIcon>
                <ContextMenuTrigger position="below-right">
                  <template #menu>
                    <div class="item delete" @click="removeFavorite(index)">
                      {{ t('settings.favorites.remove') }}
                    </div>
                  </template>
                </ContextMenuTrigger>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty-state">
        <div class="empty-message">{{ t('settings.favorites.empty') }}</div>
      </div>

      <!-- Add Favorite Modal -->
      <ModalDialog id="add-favorite-modal" ref="addFavoriteDialog" @save="onAddFavorite" width="400px">
        <template #header>
          <div class="title">{{ t('settings.favorites.addModal.title') }}</div>
        </template>
        <template #body>
          <div class="form-field">
            <label>{{ t('common.llmModel') }}</label>
            <EngineModelSelect
              :engine="selectedEngine"
              :model="selectedModel"
              :favorites="false"
              @modelSelected="onModelSelectedForAdd"
            />
          </div>
        </template>
        <template #footer>
          <div class="buttons">
            <button @click="closeAddFavoriteModal" class="tertiary">{{ t('common.cancel') }}</button>
            <button @click="onAddFavorite" class="primary" :disabled="!selectedEngine || !selectedModel">{{ t('settings.favorites.add') }}</button>
          </div>
        </template>
      </ModalDialog>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import ButtonIcon from '@components/ButtonIcon.vue'
import ContextMenuTrigger from '@components/ContextMenuTrigger.vue'
import EngineLogo from '@components/EngineLogo.vue'
import EngineModelSelect from '@components/EngineModelSelect.vue'
import ModalDialog from '@components/ModalDialog.vue'
import { engineNames } from '@services/llms/consts'
import LlmFactory, { ILlmManager } from '@services/llms/llm'
import { t } from '@services/i18n'
import { store } from '@services/store'

const llmManager: ILlmManager = LlmFactory.manager(store.config)

const addFavoriteDialog = ref(null)
const selectedEngine = ref('')
const selectedModel = ref('')

const favorites = computed(() => store.config.llm.favorites || [])

const getEngineName = (engine: string): string => {
  const name = llmManager.getEngineName(engine)
  return engineNames[name] ?? name
}

const getModelName = (engine: string, modelId: string): string => {
  if (!engine || !modelId) return ''

  const models = llmManager.getChatModels(engine)
  const model = models.find(m => m.id === modelId)
  return model?.name || modelId
}

const moveUp = (index: number) => {
  if (index === 0) return
  llmManager.reorderFavorites(index, 'up')
}

const moveDown = (index: number) => {
  if (index === favorites.value.length - 1) return
  llmManager.reorderFavorites(index, 'down')
}

const removeFavorite = (index: number) => {
  const favorite = favorites.value[index]
  llmManager.removeFavoriteModel(favorite.engine, favorite.model)
}

const showAddFavoriteModal = () => {
  selectedEngine.value = ''
  selectedModel.value = ''
  addFavoriteDialog.value.show()
}

const closeAddFavoriteModal = () => {
  addFavoriteDialog.value.close()
}

const onModelSelectedForAdd = (engine: string | null, model: string | null) => {
  selectedEngine.value = engine || ''
  selectedModel.value = model || ''
}

const onAddFavorite = () => {
  if (!selectedEngine.value || !selectedModel.value) return

  // Check if already in favorites
  const exists = favorites.value.some(
    f => f.engine === selectedEngine.value && f.model === selectedModel.value
  )

  if (!exists) {
    llmManager.addFavoriteModel(selectedEngine.value, selectedModel.value)
  }

  closeAddFavoriteModal()
}

const load = () => {
  // Nothing to load, using computed
}

defineExpose({ load })
</script>

<style scoped>
header {
  border-bottom: none;
}

main {
  padding: 4rem;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
}

.empty-message {
  font-size: var(--font-size-16);
  color: var(--color-on-surface-variant);
}

.engine-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  .logo {
    width: var(--icon-xl);
    height: var(--icon-xl);
  }
}

.engine-model-select {
  width: calc(100% - 2rem);
}
</style>
