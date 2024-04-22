<template>
	<div class="empty">
		<div class="engines">
			<EngineLogo v-for="engine in engines" :engine="engine" :grayscale="true"
				:class="{ current: isCurrentEngine(engine), hidden: !showAllEngines && !isCurrentEngine(engine) }"
				@click="onEngine(engine)"
			/>
		</div>
		<select v-if="models?.length" v-model="model" class="select-model" :class="{ hidden: showAllEngines }" @change="onSelectModel">
			<option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
		</select>
	</div>
</template>

<script setup>

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { availableEngines, isEngineReady } from '../services/llm'
import EngineLogo from './EngineLogo.vue'

const showAllEngines = ref(false)

//
// we cannot use store.config.getActiveModel here
// because we will lose reactivity :-(
//

const engines = computed(() => availableEngines.filter((e) => isEngineReady(e)))
const models = computed(() => store.config?.engines[store.config.llm.engine]?.models?.chat)
const model = computed(() => store.config?.engines[store.config.llm.engine]?.model?.chat)

const isCurrentEngine = (engine) => {
  return store.config.llm.engine === engine
}

const onEngine = (engine) => {
  if (engines.value.length < 2) return
  if (showAllEngines.value === false) {
    showAllEngines.value = true
  } else {
    showAllEngines.value = false
    store.config.llm.engine = engine
    store.saveSettings()
  }
}

const onSelectModel = (ev) => {
  let model = ev.target.value
  store.config.engines[store.config.llm.engine].model.chat = model
  store.saveSettings()
}

</script>

<style scoped>

.empty {
  height: 100vh;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.empty .engines {
  display: flex;
  justify-content: center;
  align-items: center;
}

.empty .engines .logo {
  transition: all 0.2s;
  flex: 0 0 48px;
  cursor: pointer;
  margin: 0px 16px;
  width: 48px;
  height: 48px;
}

.empty .engines .logo.hidden {
  width: 0px;
  flex-basis: 0px;
  margin: 0px;
}

.empty .select-model {
  border: none;
  outline: none;
  margin-top: 16px;
  padding: 0px;
  font-size: 12pt;
  text-align: center;
  cursor: pointer;
}

.empty .select-model.hidden {
  visibility: hidden;
}

</style>
