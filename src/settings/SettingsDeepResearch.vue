<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.deepResearch') }}</div>
    </header>
    <main class="form form-vertical form-large">
      <div class="form-field layout">
        <label>{{ t('settings.deepResearch.runtime') }}</label>
        <select v-model="runtime" @change="save">
          <option value="ma">{{ t('settings.deepResearch.runtimes.ma') }}</option>
          <option value="ms">{{ t('settings.deepResearch.runtimes.ms') }}</option>
        </select>
      </div>
      <div class="form-field breadth">
        <label>{{ t('settings.deepResearch.breadth') }}</label>
        <div class="control-group">
          <span class="slider-label">{{ t('settings.deepResearch.breadths.narrow') }}</span>
          <div class="slider-group">
            <input type="range" min="2" max="6" step="2" v-model="breadth" @input="save" />
            <datalist id="fontsize">
              <option value="2"></option>
              <option value="4"></option>
              <option value="6"></option>
            </datalist>
          </div>
          <span class="slider-label">{{ t('settings.deepResearch.breadths.wide') }}</span>
        </div>
      </div>
      <div class="form-field depth">
        <label>{{ t('settings.deepResearch.depth') }}</label>
        <div class="control-group">
          <span class="slider-label">{{ t('settings.deepResearch.depths.shallow') }}</span>
          <div class="slider-group">
            <input type="range" min="1" max="3" v-model="depth" @input="save" />
            <datalist id="fontsize">
              <option value="1"></option>
              <option value="2"></option>
              <option value="3"></option>
            </datalist>
          </div>
          <span class="slider-label">{{ t('settings.deepResearch.depths.deep') }}</span>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">

import { DeepResearchRuntime } from '../types/config'
import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'

const runtime = ref<DeepResearchRuntime>('ms')
const breadth = ref(4)
const depth = ref(1)

const load = () => {
  runtime.value = store.config.deepresearch.runtime || 'ms'
  breadth.value = store.config.deepresearch.breadth || 4
  depth.value = store.config.deepresearch.depth || 1
}

const save = () => {
  store.config.deepresearch.runtime = runtime.value
  store.config.deepresearch.breadth = parseInt(breadth.value.toString())
  store.config.deepresearch.depth = parseInt(depth.value.toString())
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>

.form-field.breadth, .form-field.depth {
  margin-top: 1rem;
  margin-bottom: 1rem;

  .control-group {
    margin-top: 0.5rem;
    align-self: center;
    width: 80%;
  }
}

</style>
