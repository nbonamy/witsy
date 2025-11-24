<template>
  <div class="sidebar-features">
    <div class="form form-vertical form-large features-grid">
      <div
        v-for="feature in features"
        :key="feature.key"
        class="form-field horizontal"
      >
        <input
          type="checkbox"
          :id="`feature-${feature.key}`"
          :checked="!hiddenFeatures.includes(feature.key)"
          @change="onToggleFeature(feature.key)"
        />
        <label :for="`feature-${feature.key}`">{{ t(feature.label) }}</label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { t } from '@services/i18n'
import { store } from '@services/store'

const features = [
  { key: 'studio', label: 'designStudio.title' },
  { key: 'scratchpad', label: 'scratchpad.title' },
  { key: 'dictation', label: 'transcribe.title' },
  { key: 'voiceMode', label: 'realtimeChat.title' },
  { key: 'computerUse', label: 'computerUse.title' },
].filter(f => store.isFeatureEnabled(f.key))

const hiddenFeatures = computed(() => {
  return store.workspace?.hiddenFeatures || []
})

const emit = defineEmits(['save'])

const onToggleFeature = (featureKey: string) => {
  if (!store.workspace) return

  const hidden = store.workspace.hiddenFeatures || []
  const index = hidden.indexOf(featureKey)

  if (index === -1) {
    // Feature is visible, hide it
    hidden.push(featureKey)
  } else {
    // Feature is hidden, show it
    hidden.splice(index, 1)
  }

  store.workspace.hiddenFeatures = hidden
  emit('save')
}

</script>

<style scoped>

.sidebar-features {
  margin-bottom: 3rem;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem 2rem;

  label {
    font-size: 15px;
  }
}

</style>