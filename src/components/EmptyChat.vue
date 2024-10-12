
<template>
	<div class="empty">
    <div class="tip engine" v-if="showEngineTip()">
      Click here to switch to a different chat bot provider!<br/>
      <img src="/assets/arrow_dashed.svg" />
    </div>
		<div class="engines">
			<EngineLogo v-for="engine in engines" :engine="engine" :grayscale="true"
				:class="{ current: isCurrentEngine(engine), hidden: !showAllEngines && !isCurrentEngine(engine) }"
				@click="onEngine(engine)"
			/>
		</div>
		<select v-if="models?.length" v-model="model" class="select-model" :class="{ hidden: showAllEngines }" @change="onSelectModel" @click="onClickModel">
			<option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
		</select>
    <div class="tip model" v-if="showModelTip()">
      <img src="/assets/arrow_dashed.svg" /><br/>
      Click here to switch to a different chat bot model!
    </div>
	</div>
</template>

<script setup>

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { availableEngines, isEngineReady, hasChatModels } from '../services/llm'
import Swal from 'sweetalert2/dist/sweetalert2.js'
import EngineLogo from './EngineLogo.vue'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const showAllEngines = ref(false)

//
// we cannot use store.config.getActiveModel here
// because we will lose reactivity :-(
//

const engines = computed(() => availableEngines)
const models = computed(() => store.config?.engines[store.config.llm.engine]?.models?.chat)
const model = computed(() => store.config?.engines[store.config.llm.engine]?.model?.chat)

const isCurrentEngine = (engine) => {
  return store.config.llm.engine === engine
}

const showEngineTip = () => {
  return store.config.general.tips.engineSelector && !showAllEngines.value && engines.value.length > 1
}

const showModelTip = () => {
  return !store.config.general.tips.engineSelector && store.config.general.tips.modelSelector && !showAllEngines.value && models.value.length > 1
}

const onEngine = (engine) => {

  if (showAllEngines.value === false) {

    // show all always
    showAllEngines.value = true
  
  } else {

    // check if the engine is ready
    if (!isEngineReady(engine) || !hasChatModels(engine)) {
      Swal.fire({
        title: 'This engine needs to be configured first! Do you want to open the Settings?',
        confirmButtonText: 'Configure',
        showCancelButton: true,
      }).then((result) => {
        if (result.isConfirmed) {
          emitEvent('open-settings', { initialTab: 'models', engine: engine })
        }
      })
      return
    }

    // close and disable tip
    showAllEngines.value = false
    store.config.general.tips.engineSelector = false

    // select the engine
    store.config.llm.engine = engine
    store.saveSettings()

  }

}

const onClickModel = () => {
  store.config.general.tips.modelSelector = false
  store.saveSettings()
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

.empty .tip {
  font-family: Garamond, Georgia, Times, 'Times New Roman', serif;
  text-align: center;
  font-style: italic;
  font-size: 11pt;
  color: #888;
  margin-bottom: 16px;

  img {
    margin-top: 4px;
    width: 32px;
    rotate: 90deg;
    stroke: #888;
  }

  &.model {
    img {
      rotate: 270deg;
    }
  }
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
  font-size: 11pt;
  text-align: center;
  cursor: pointer;
}

.empty .select-model.hidden {
  visibility: hidden;
}

</style>
