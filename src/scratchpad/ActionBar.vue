<template>
  <div class="actionbar-wrapper">
    
    <div class="actionbar" v-if="activeBar == 'standard'">
      
      <div class="action" @click="emitEvent('action', 'undo')" v-tooltip="'Undo'" :class="{ disabled: !undoStack.length }">
        <BIconReplyFill />
      </div>
      
      <div class="action" @click="emitEvent('action', 'redo')" v-tooltip="'Redo'" :class="{ disabled: !redoStack.length }">
        <BIconReplyFill style="transform: scaleX(-1)"/>
      </div>
      
      <div class="action" @click="emitEvent('action', 'copy')" v-tooltip="'Copy to clipboard'">
        <BIconClipboard v-if="copyState == 'idle'"/>
        <BIconClipboardCheck style="color: var(--scratchpad-actionbar-active-icon-color)" v-else/>
      </div>
      
      <div class="action" @click="onMagicAction($event, 'spellcheck')" v-tooltip="'Spellcheck'">
        <BIconSpellcheck />
      </div>
      
      <div class="action" @click="onMagicBar" v-tooltip="'Writing assistant'">
        <BIconStars />
      </div>
      
      <div :class="{ action: true, active: audioState == 'playing', static: true }" @click="emitEvent('action', 'read')" v-tooltip="'Read aloud'">
        <span v-if="audioState == 'playing'"><BIconStopCircle/></span>
        <span v-else-if="audioState == 'loading'"><BIconXCircle/></span>
        <span v-else><BIconVolumeUp /></span>
      </div>
    
    </div>
    
    <div class="actionbar" v-if="activeBar == 'magic'">
      
      <div class="action" @click="onStandardBar" v-tooltip="'Back'">
        <BIconArrowLeft />
      </div>
      
      <div class="action" @click="onMagicAction($event, 'improve')" v-tooltip="'Improve writing'">
        <BIconMortarboard />
      </div>
      
      <div class="action" @click="onMagicAction($event, 'takeaways')" v-tooltip="'List key takeaways'">
        <BIconListUl />
      </div>
      
      <div class="action" @click="onMagicAction($event, 'title')" v-tooltip="'Suggest a title'">
        <BIconFonts />
      </div>
      
      <div class="action" @click="onMagicAction($event, 'simplify')" v-tooltip="'Simplify writing'">
        <BIconChevronBarContract />
      </div>
      
      <div class="action" @click="onMagicAction($event, 'expand')" v-tooltip="'Expand writing'">
        <BIconChevronBarExpand />
      </div>
    
    </div>
  
  </div>
</template>

<script setup lang="ts">

// components
import { ref, onMounted } from 'vue'
import FloatingVue, { vTooltip } from 'floating-vue'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

defineProps({
  undoStack: Array,
  redoStack: Array,
  copyState: String,
  audioState: String
})

const activeBar = ref('standard')

FloatingVue.options.distance = 16
FloatingVue.options.instantMove = true
FloatingVue.options.autoHideOnMousedown = true
FloatingVue.options.themes.tooltip.placement = 'left'
FloatingVue.options.themes.tooltip.delay.show = 0

onMounted(() => {
  onEvent('llm-done', () => {
    document.querySelectorAll('.action.active').forEach(el => el.classList.remove('active'))
  })
})

const onMagicBar = () => {
  activeBar.value = 'magic'
}

const onStandardBar = () => {
  activeBar.value = 'standard'
}

const onMagicAction = (event: Event, action: string) => {
  (event.target as HTMLElement).closest('.action').classList.add('active')
  emitEvent('action', { type: 'magic', value: action } )
}

</script>

<style>
@import 'floating-vue/dist/style.css';
</style>

<style scoped>

.actionbar-wrapper {
  
  position: absolute;
  right: 20px;
  bottom: 64px;
  border: 1px solid var(--scratchpad-actionbar-border-color);
  border-radius: 20px;
  padding: 16px 12px;
  box-shadow: 0 0 8px var(--scratchpad-actionbar-shadow-color);
  transition: height 0.15s linear;
  background-color: var(--scratchpad-actionbar-bg-color);
  z-index: 10;

  &:hover {
    border-color: var(--scratchpad-actionbbar-active-border-color);
  }

  .actionbar {
    display: flex;
    flex-direction: column-reverse;
    gap: 12px;
  }
  
  .action {
    color: var(--scratchpad-actionbar-normal-icon-color);
    font-size: 14pt;
    cursor: pointer;

    &.disabled {
      color: var(--scratchpad-actionbar-disabled-icon-color);
    }

    &:not(.disabled):hover {
      color: var(--scratchpad-actionbar-hover-icon-color);
    }

    &.active {
      color: var(--scratchpad-actionbar-active-icon-color);
    }

    &.active:not(.static) {
      animation: active 750ms ease-in-out infinite alternate;
    }
  }
}

@keyframes active {
  0% { color: var(--scratchpad-actionbar-active-icon-color); transform: scale(0.9);  }
  100% { color: var(--scratchpad-actionbar-active-icon-color2); transform: scale(1.1); }
}

</style>
