
<template>
	<div class="empty">
    <div class="tip engine" v-if="showEngineTip()">
      Click here to switch to a different chat bot provider!<br/>
      <img src="/assets/arrow_dashed.svg" />
    </div>
    <div class="engine">
      <div class="engines">
        <EngineLogo v-for="engine in llmFactory.getChatEngines()" :engine="engine" :grayscale="true" :custom-label="true" @click="onEngine(engine)" />
      </div>
      <div class="current">
        <EngineLogo :engine="store.config.llm.engine" :grayscale="true" :custom-label="true" @click="onEngine(store.config.llm.engine)" />
        <select v-if="models?.length" v-model="model" class="select-model" :class="{ hidden: showAllEngines }" @change="onSelectModel" @click="onClickModel">
          <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <div class="favorite" v-if="!showModelTip() && !showAllEngines">
          <span @click="removeFavorite" v-if="isFavoriteModel"><BIconStarFill /> Remove from favorites</span>
          <span @click="addToFavorites" v-else><BIconStar /> Add to favorites</span>
        </div>
        <div class="tip model" v-if="showModelTip()">
          <img src="/assets/arrow_dashed.svg" /><br/>
          Click here to switch to a different chat bot model!
        </div>
      </div>
    </div>
	</div>
</template>

<script setup lang="ts">

import { ref, shallowReactive, computed, onMounted, onBeforeUpdate, onUpdated } from 'vue'
import { store } from '../services/store'
import EngineLogo from './EngineLogo.vue'
import useTipsManager from '../composables/tips_manager'
import Dialog from '../composables/dialog'
import LlmFactory from '../llms/llm'

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const tipsManager = useTipsManager(store)
const llmFactory = new LlmFactory(store.config)

const showAllEngines = ref(false)
const engines = shallowReactive(store.config.engines)

const models = computed(() => llmFactory.getChatModels(store.config.llm.engine))
const model = computed(() => llmFactory.getChatModel(store.config.llm.engine, true))
const isFavoriteModel = computed(() => llmFactory.isFavoriteModel(store.config.llm.engine, model.value))

const showEngineTip = () => {
  return tipsManager.isTipAvailable('engineSelector') && !showAllEngines.value && Object.keys(engines).length > 1
}

const showModelTip = () => {
  return !tipsManager.isTipAvailable('engineSelector') && tipsManager.isTipAvailable('modelSelector') && !showAllEngines.value && models.value.length > 1
}

onBeforeUpdate(() => {
  if (store.config.engines[store.config.llm.engine] === undefined) {
    store.config.llm.engine = 'openai'
  }
})

onMounted(() => {
  centerCurrentEngineLogo()
})

onUpdated(() => {
  centerCurrentEngineLogo()
})

const centerCurrentEngineLogo = () => {

  const engines = document.querySelector<HTMLElement>('.engines')
  const current = document.querySelector<HTMLElement>('.current')
  if (!engines || !current) return
  
  const logo = current.querySelector<HTMLElement>('.logo')

  const rc1 = engines.getBoundingClientRect()
  const midY1 = rc1.top + rc1.height / 2

  const rc2 = logo.getBoundingClientRect()
  const midY2 = rc2.top + rc2.height / 2

  let top = parseInt(current.style.top) || 0
  current.style.top = `${top+midY1-midY2}px`

  const tip = document.querySelector<HTMLElement>('.tip.engine')
  if (tip) {
    top = parseInt(tip.style.top) || 0
    tip.style.top = `${top+midY1-midY2}px`
  }

}

const onEngine = (engine: string) => {

  if (showAllEngines.value === false) {

    // show all always
    showAllEngines.value = true

    // now animate current icon to the ones in the selector
    const current = store.config.llm.engine
    animateEngineLogo(`.engine .current .logo`, `.engines .logo.${current}`, (elems, progress) => {
      if (elems) {
        elems.clone.style.opacity = Math.max(0, 1 - 1.25 * progress).toString()
        elems.container.style.opacity = Math.min(1, 1.25 * (progress - 0.25)).toString()
        if (progress >= 1) {
          elems.clone.remove()
          elems.container.style.opacity = '1'
          elems.source.parentElement.style.pointerEvents = 'none'
        }
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
    animateEngineLogo(`.engines .logo.${engine}`, `.engine .current .logo`, (elems, progress) => {
      if (elems) {
        elems.clone.style.opacity = Math.max(0, 1 - 1.25 * progress).toString()
        elems.container.style.opacity = Math.max(0, 1 - 1.25 * progress).toString()
        if (progress >= 1) {
          elems.clone.remove()
          elems.container.style.opacity = '0'
          elems.source.style.opacity = '1'
          elems.target.style.opacity = '1'
          elems.target.parentElement.style.pointerEvents = 'auto'
        }
      }
      if (progress >= 1) {
        showAllEngines.value = false
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

  } catch (error) {
    console.log(error)
    callback(null, 1)
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
  llmFactory.setChatModel(store.config.llm.engine, target.value)
}

const addToFavorites = () => {
  llmFactory.addFavoriteModel(store.config.llm.engine, model.value)
  tipsManager.showTip('favoriteModels')
}

const removeFavorite = () => {
  llmFactory.removeFavoriteModel(store.config.llm.engine, model.value)
}

</script>

<style scoped>

.empty {
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
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty .engines {
  position: relative;
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
  display: flex;
  flex-direction: column;
  align-items: center;
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

.favorite {

  margin-top: 1rem;
  cursor: pointer;
  font-size: 9.5pt;
  
  > * {
    display: flex;
    align-items: center;
    gap: .5rem;
  }
}

</style>
