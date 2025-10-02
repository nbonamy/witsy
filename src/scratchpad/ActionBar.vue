<template>
  <div class="actionbar-wrapper">
    
    <div class="actionbar" v-if="activeBar == 'standard'">
      
      <div class="action" @click="emitEvent('action', 'undo')" v-tooltip="t('common.undo')" :class="{ disabled: !undoStack.length }">
        <UndoIcon />
      </div>
      
      <div class="action" @click="emitEvent('action', 'redo')" v-tooltip="t('common.redo')" :class="{ disabled: !redoStack.length }">
        <RedoIcon />
      </div>
      
      <div class="action" @click="emitEvent('action', 'copy')" v-tooltip="t('scratchpad.actions.copyToClipboard')">
        <ClipboardIcon v-if="copyState == 'idle'"/>
        <ClipboardCheckIcon style="color: var(--scratchpad-actionbar-active-icon-color)" v-else/>
      </div>
      
      <div class="action" @click="onMagicAction($event, 'spellcheck')" v-tooltip="t('scratchpad.actions.spellcheck')">
        <SpellCheckIcon />
      </div>
      
      <div class="action" @click="onMagicBar" v-tooltip="t('scratchpad.actions.writingAssistant')">
        <SparklesIcon />
      </div>
      
      <div :class="{ action: true, active: audioState == 'playing', static: true }" @click="emitEvent('action', 'read')" v-tooltip="t('common.read')">
        <span v-if="audioState == 'playing'"><StopCircleIcon/></span>
        <span v-else-if="audioState == 'loading'"><CircleXIcon/></span>
        <span v-else><Volume2Icon /></span>
      </div>
    
    </div>
    
    <div class="actionbar" v-if="activeBar == 'magic'">
      
      <div class="action" @click="onStandardBar" v-tooltip="t('common.back')">
        <MoveLeftIcon />
      </div>
      
      <div class="action" @click="onMagicAction($event, 'improve')" v-tooltip="t('scratchpad.actions.improveWriting')">
        <GraduationCapIcon />
      </div>
      
      <div class="action" @click="onMagicAction($event, 'takeaways')" v-tooltip="t('scratchpad.actions.listTakeaways')">
        <ListIcon />
      </div>
      
      <div class="action" @click="onMagicAction($event, 'title')" v-tooltip="t('scratchpad.actions.suggestTitle')">
        <TypeOutlineIcon />
      </div>
      
      <div class="action" @click="onMagicAction($event, 'simplify')" v-tooltip="t('scratchpad.actions.simplifyWriting')">
        <FoldVerticalIcon />
      </div>
      
      <div class="action" @click="onMagicAction($event, 'expand')" v-tooltip="t('scratchpad.actions.expandWriting')">
        <UnfoldVerticalIcon />
      </div>
    
      <div class="action" @click="onMagicAction($event, 'complete')" v-tooltip="t('scratchpad.actions.completeText')" >
        <PencilLineIcon />
      </div>
    
    </div>
  
  </div>
</template>

<script setup lang="ts">

import FloatingVue, { vTooltip } from 'floating-vue'
import { ClipboardCheckIcon, ClipboardIcon, FoldVerticalIcon, GraduationCapIcon, ListIcon, MoveLeftIcon, PencilLineIcon, RedoIcon, SparklesIcon, SpellCheckIcon, StopCircleIcon, TypeOutlineIcon, UndoIcon, UnfoldVerticalIcon, Volume2Icon, CircleXIcon } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { t } from '../services/i18n'

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
  right: 1.5rem;
  top: 55%;
  transform: translateY(-50%);
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
    font-size: 18.5px;
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
