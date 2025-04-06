<template>
  <div class="empty">
    <div class="selector">
      <div class="engines">
        <EngineLogo v-for="engine in llmManager.getChatEngines()" :engine="engine" :grayscale="true" :custom-label="true" @click="onEngine(engine)" />
      </div>
      <div class="current">
        <div class="tip engine" v-if="showEngineTip()">
          {{ t('emptyChat.tips.switchProvider') }}<br/>
          <img src="/assets/arrow_dashed.svg" @load="centerLogos()" />
        </div>
        <EngineLogo :engine="store.config.llm.engine" :grayscale="true" :custom-label="true" @click="onEngine(store.config.llm.engine)" />
        <div class="models">
          <select v-if="models?.length" v-model="model" class="select-model" :class="{ hidden: showAllEngines }" @change="onSelectModel" @click="onClickModel">
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
          <BIconArrowRepeat v-if="!showAllEngines && store.config.llm.engine != favoriteMockEngine" @click="onRefreshModels" :class="{ 'rotating': isRefreshing }"/>
        </div>
        <div class="favorite" v-if="!showModelTip() && !showAllEngines">
          <span class="action remove" @click="removeFavorite" v-if="isFavoriteModel"><BIconStarFill /> {{ t('common.favorites.remove') }}</span>
          <span class="action add" @click="addToFavorites" v-else><BIconStar /> {{ t('common.favorites.add') }}</span>
          <span class="shortcut" v-if="modelShortcut">{{ t('emptyChat.favorites.shortcut', { shortcut: modelShortcut }) }}</span>
        </div>
        <div class="tip model" v-if="showModelTip()">
          <img src="/assets/arrow_dashed.svg" @load="centerLogos()" /><br/>
          {{ t('emptyChat.tips.switchModel') }}
        </div>
      </div>
    </div>
    <div class="actions" :class="{ hidden: showAllEngines }">
      <div class="action" @click="onCreateMedia">
        <BIconPaletteFill />
        {{ t('designStudio.title') }}
      </div>
      <div class="action" @click="onScratchpad">
        <BIconJournalText />
        {{ t('scratchpad.title') }}
      </div>
      <div class="action" @click="onDictation">
        <BIconMic />
        {{ t('transcribe.title') }}
      </div>
      <div class="action" @click="onVoiceMode">
        <BIconChatSquareDots />
        {{ t('realtimeChat.title') }}
      </div>
      <div class="action" @click="onComputerUse" v-if="hasComputerUse">
        <BIconRobot />
        {{ t('computerUse.title') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, shallowReactive, computed, onMounted, onUnmounted, onBeforeUpdate, onUpdated } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import EngineLogo from './EngineLogo.vue'
import useTipsManager from '../composables/tips_manager'
import Dialog from '../composables/dialog'
import LlmFactory, { favoriteMockEngine } from '../llms/llm'

import useEventBus from '../composables/event_bus'
import { BIconArrowRepeat, BIconChatSquareDots } from 'bootstrap-icons-vue'
const { emitEvent } = useEventBus()

const tipsManager = useTipsManager(store)
const llmManager = LlmFactory.manager(store.config)

const showAllEngines = ref(false)
const engines = shallowReactive(store.config.engines)
const isRefreshing = ref(false)

const models = computed(() => llmManager.getChatModels(store.config.llm.engine))
const model = computed(() => llmManager.getChatModel(store.config.llm.engine, true))
const isFavoriteModel = computed(() => llmManager.isFavoriteModel(store.config.llm.engine, model.value))

const hasComputerUse = computed(() => {
  return store.config.engines.anthropic.apiKey && store.config.engines.anthropic.models?.chat?.find(m => m.id === 'computer-use')
})

const modelShortcut = computed(() => {
  const favorites = llmManager.getChatModels(favoriteMockEngine)
  const id = store.config.llm.engine == favoriteMockEngine ? model.value : llmManager.getFavoriteId(store.config.llm.engine, model.value)
  let index = favorites.findIndex(m => m.id === id)
  if (index < 0 || index > 9) return null
  if (index === 9) index = -1
  const mod = window.api.platform == 'darwin' ? '⌥' : 'Alt'
  return `${mod}+${String.fromCharCode(49 + index)}`
})

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
  centerLogos()
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})

onUpdated(() => {
  centerLogos()
})

const onKeyDown = (ev: KeyboardEvent) => {
  if (showAllEngines.value) return
  const favorites = llmManager.getChatModels(favoriteMockEngine)
  if (!favorites.length) return
  if (!ev.altKey) return
  let index = ev.keyCode - 49
  if (index === -1) index = 9
  if (index < 0 || index > favorites.length-1) return
  llmManager.setChatModel(favoriteMockEngine, favorites[index].id)
}

const centerLogos = () => {

  // get the engines and current
  const engines = document.querySelector<HTMLElement>('.selector .engines')
  const current = document.querySelector<HTMLElement>('.selector .current')
  if (!engines || !current) {
    return
  }

  // get vertical center of engines
  const rc1 = engines.getBoundingClientRect()
  const midY1 = rc1.top + rc1.height / 2

  // get verical center of logo
  const logo = current.querySelector<HTMLElement>('.logo')
  const rc2 = logo.getBoundingClientRect()
  const midY2 = rc2.top + rc2.height / 2

  // align current engine so that the logo is centered 
  let top = parseInt(current.style.top) || 0
  top = top+midY1-midY2
  current.style.top = `${top}px`

  const actions = document.querySelector<HTMLElement>('.actions')
  if (actions) {
    const minHeight = parseInt(getComputedStyle(engines).minHeight)
    if (rc1.height > minHeight) {
      const offset = rc1.height - minHeight
      actions.style.top = `${-offset/2}px`
    } else {
      actions.style.top = '0px'
    }
  }


}

const onEngine = (engine: string) => {
  if (showAllEngines.value === false) {

    // show all always
    showAllEngines.value = true

    // now animate current icon to the ones in the selector
    const current = store.config.llm.engine
    animateEngineLogo(`.selector .current .logo`, `.selector .engines .logo.${current}`, (elems, progress) => {
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
    if (!llmManager.isEngineReady(engine) || !llmManager.hasChatModels(engine)) {
      Dialog.show({
        title: t('emptyChat.settings.needsConfiguration'),
        confirmButtonText: t('emptyChat.settings.configure'),
        showCancelButton: true,
      }).then((result) => {
        if (result.isConfirmed) {
          window.api.settings.open({ initialTab: 'models', engine: engine })
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
    animateEngineLogo(`.selector .engines .logo.${engine}`, `.selector .current .logo`, (elems, progress) => {
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
    //console.log(error)
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

const onRefreshModels = async () => {
  isRefreshing.value = true
  try {
    await llmManager.loadModels(store.config.llm.engine)
  } finally {
    isRefreshing.value = false
  }
}

const onClickModel = () => {
  store.config.general.tips.modelSelector = false
  store.saveSettings()
}

const onSelectModel = (ev: Event) => {

  // target
  const target = ev.target as HTMLSelectElement

  // computer-use warning
  if (llmManager.isComputerUseModel(store.config.llm.engine, target.value)) {
    tipsManager.showTip('computerUse')
  }

  // continue
  llmManager.setChatModel(store.config.llm.engine, target.value)
}

const addToFavorites = () => {
  llmManager.addFavoriteModel(store.config.llm.engine, model.value)
  tipsManager.showTip('favoriteModels')
}

const removeFavorite = () => {
  llmManager.removeFavoriteModel(store.config.llm.engine, model.value)
}

const onCreateMedia = () => {
  window.api.studio.start()
}

const onScratchpad = () => {
  window.api.scratchpad.open()
}

const onDictation = () => {
  window.api.transcribe.start()
}

const onVoiceMode = () => {
  window.api.voiceMode.start()
}

const onComputerUse = () => {
  emitEvent('activate-computer-use')
}

</script>

<style scoped>

.hidden {
  visibility: hidden;
}

.empty {
  padding: 16px;
  margin-top: -48px;
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
  margin-bottom: 0px;

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

}

.windows .empty .tip {
  font-size: 14pt;
}

.empty .selector {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty .engines {
  display: flex;
  max-width: 400px;
  min-height: 240px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  align-content: center;
  opacity: 0;
}

.empty .selector .logo {
  flex: 0 0 48px;
  cursor: pointer;
  margin: 16px;
  width: 48px;
  height: 48px;
  opacity: 1;
}

.empty .selector .current {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty .models {
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    visibility: hidden;
    cursor: pointer;
    position: relative;
    top: 4px;
  }

  .rotating {
    animation: spin 1.5s linear infinite;
  }

  &:hover {
    svg {
      visibility: visible;
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.empty .select-model {
  z-index: 2;
  border: 0.5px solid transparent;
  outline: none;
  margin-top: 8px;
  padding: 4px 0px;
  font-size: 11pt;
  text-align: center;
  cursor: pointer;
  border-radius: 8px;
  background-color: var(--message-list-bg-color);
  color: var(--message-list-text-color);
}

.models:hover .select-model {
  border: 0.5px solid var(--control-border-color);
}

.favorite {
  margin-top: 1rem;
  font-size: 9.5pt;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  .action {
    cursor: pointer;
  }

  .shortcut {
    opacity: 0.5;
  }
}

.actions {
  position: relative;
  margin-top: 2rem;
  margin-left: 4rem;
  margin-right: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;

  --action-bg-color-alpha-normal: 97.5%;
  --action-bg-color-alpha-hover: 92.5%;

  .action {
    display: flex;
    align-items: center;
    font-size: 10.5pt;
    gap: 0.5rem;
    padding: 6px 16px;
    border-radius: 8px;
    background-color: color-mix(in srgb, var(--text-color), transparent var(--action-bg-color-alpha-normal));
    border: 1px solid var(--control-border-color);
    cursor: pointer;

    &:hover {
      background-color: color-mix(in srgb, var(--text-color), transparent var(--action-bg-color-alpha-hover));
    }
  }
}

.empty:has(.shortcut) .actions {
  margin-top: 3rem;
}

.empty:has(.tip.model) .actions {
  margin-top: 4rem;
}

@media (prefers-color-scheme: dark) {
  .actions {
    --action-bg-color-alpha-normal: 92.5%;
    --action-bg-color-alpha-hover: 85%;
  }
}

</style>
