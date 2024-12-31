
<template>
	<div class="empty">
    <div class="tip engine" v-if="showEngineTip()">
      Click here to switch to a different chat bot provider!<br/>
      <img src="/assets/arrow_dashed.svg" />
    </div>
    <div class="engine">
      <div class="engines">
        <EngineLogo v-for="engine in engines" :engine="engine" :grayscale="true" @click="onEngine(engine)" />
      </div>
      <EngineLogo :engine="store.config.llm.engine" :grayscale="true" class="current" @click="onEngine(store.config.llm.engine)" />
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

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import LlmFactory, { availableEngines } from '../llms/llm'
import useTipsManager from '../composables/tips_manager'
import Dialog from '../composables/dialog'
import EngineLogo from './EngineLogo.vue'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const tipsManager = useTipsManager(store)
const llmFactory = new LlmFactory(store.config)

const showAllEngines = ref(false)

//
// we cannot use llm.getChatEngineModel here
// because we will lose reactivity :-(
//

const engines = computed(() => availableEngines)
const models = computed(() => store.config?.engines[store.config.llm.engine]?.models?.chat)
const model = computed(() => store.config?.engines[store.config.llm.engine]?.model?.chat)

const showEngineTip = () => {
  return tipsManager.isTipAvailable('engineSelector') && !showAllEngines.value && engines.value.length > 1
}

const showModelTip = () => {
  return !tipsManager.isTipAvailable('engineSelector') && tipsManager.isTipAvailable('modelSelector') && !showAllEngines.value && models.value.length > 1
}

const onEngine = (engine: string) => {

  if (showAllEngines.value === false) {

    // show all always
    showAllEngines.value = true

    // now animate current icon to the ones in the selector
    const current = store.config.llm.engine
    animateEngineLogo(`.engine .logo.current`, `.engines .logo.${current}`, (elems, progress) => {
      elems.clone.style.opacity = Math.max(0, 1 - 1.25 * progress).toString()
      elems.container.style.opacity = Math.min(1, 1.25 * (progress - 0.25)).toString()
      if (progress >= 1) {
        elems.clone.remove()
        elems.container.style.opacity = '1'
      }
    })
  
  } else {

    // check if the engine is ready
    if (!llmFactory.isEngineReady(engine) || !llmFactory.hasChatModels(engine)) {
      Dialog.show({
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
    store.config.general.tips.engineSelector = false

    // select the engine
    store.config.llm.engine = engine
    store.saveSettings()

    // and do the animation in reverse
    animateEngineLogo(`.engines .logo.${engine}`, `.engine .logo.current`, (elems, progress) => {
      elems.clone.style.opacity = Math.max(0, 1 - 1.25 * progress).toString()
      elems.container.style.opacity = Math.max(0, 1 - 1.25 * progress).toString()
      if (progress >= 1) {
        elems.clone.remove()
        showAllEngines.value = false
        elems.container.style.opacity = '0'
        elems.target.style.opacity = '1'
        elems.source.style.opacity = '1'
      }
    })

  }

}

const animateEngineLogo = (srcSelector: string, dstSelector: string, callback: (elems: {
  container: HTMLElement,
  source: HTMLElement,
  target: HTMLElement,
  clone: HTMLElement
}, progress: number) => void) => {

  try {

    const container = document.querySelector<HTMLElement>('.engines')
    const source = document.querySelector<HTMLElement>(srcSelector)
    const target = document.querySelector<HTMLElement>(dstSelector)
    const clone = source.cloneNode(true) as HTMLElement
    clone.style.position = 'absolute'
    clone.style.width = source.getBoundingClientRect().width + 'px'
    clone.style.height = source.getBoundingClientRect().height + 'px'
    clone.style.left = source.getBoundingClientRect().left + 'px'
    clone.style.top = source.getBoundingClientRect().top + 'px'
    document.body.appendChild(clone)
    source.style.opacity = '0'
    const targetX = target.getBoundingClientRect().left
    const targetY = target.getBoundingClientRect().top
    moveElement(clone, targetX, targetY, 150, (progress) => callback({ container, source, target, clone }, progress))

  } catch (e) {
    if (!process.env.TEST) {
      console.error(e)
    }
  }

}

const moveElement = (element: HTMLElement, endX: number, endY: number, duration: number, callback: (progress: number) => void) => {

  const startX = parseInt(element.style.left)
  const startY = parseInt(element.style.top)
  var startTime: DOMHighResTimeStamp = null;

  function animate(currentTime: DOMHighResTimeStamp) {
    if (!startTime) startTime = currentTime;
    var timeElapsed = currentTime - startTime;
    var progress = Math.min(timeElapsed / duration, 1);

    element.style.left = startX + (endX - startX) * progress + 'px';
    element.style.top = startY + (endY - startY) * progress + 'px';

    if (progress < 1) {
      requestAnimationFrame(animate);
      callback(progress)
    } else if (progress > 0) {
      callback(1)
    }
  }

  requestAnimationFrame(animate);
}

const onClickModel = () => {
  store.config.general.tips.modelSelector = false
  store.saveSettings()
}

const onSelectModel = (ev: Event) => {

  // target
  const target = ev.target as HTMLSelectElement

  // anthropic computer-use warning
  if (store.config.llm.engine === 'anthropic' && target.value === 'computer-use') {
    tipsManager.showTip('computerUse')
  }

  // continue
  let model = target.value
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
  background-color: var(--message-list-bg-color);
  color: var(--message-list-text-color);
}

.empty .tip {
  font-family: Garamond, Georgia, Times, 'Times New Roman', serif;
  text-align: center;
  font-style: italic;
  font-size: 11pt;
  color: var(--message-list-tip-text-color);
  margin-bottom: 16px;

  img {
    margin-top: 4px;
    width: 32px;
    rotate: 90deg;
    stroke: var(--message-list-tip-text-color);
  }

  &.model {
    img {
      rotate: 270deg;
    }
  }

  &.engine {
    top: 96px;
  }
}

.windows .empty .tip {
  font-size: 14pt;
}

.empty .engine {
  position: relative;
}

.empty .engines {
  position: relative;
  top: 40px;
  display: flex;
  max-width: 400px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  opacity: 0;
}

.empty .engine .logo {
  flex: 0 0 48px;
  cursor: pointer;
  margin: 16px;
  width: 48px;
  height: 48px;
  opacity: 1;
}

.empty .engine .current {
  position: absolute;
  bottom: 0;
  left: 50%;
  margin-left: -24px;
}

.empty .select-model {
  z-index: 2;
  border: none;
  outline: none;
  margin-top: 16px;
  padding: 0px;
  font-size: 11pt;
  text-align: center;
  cursor: pointer;
  background-color: var(--message-list-bg-color);
  color: var(--message-list-text-color);
}

.empty .select-model.hidden {
  visibility: hidden;
}

</style>
