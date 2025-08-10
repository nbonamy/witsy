<template>
  <Teleport to="body" :disabled="!teleport">
    <Overlay @click="onOverlay" />
    <div class="context-menu" :style="position" @keydown="onKeyDown" @keyup="onKeyUp">
      <div class="filter" v-if="showFilter">
        <input v-model="filter" :placeholder="t('common.search')" autofocus="true" @keydown.stop="onKeyDown" @keyup.stop="onKeyUp" />
      </div>
      <div class="actions" ref="list">
        <template v-for="action in visibleActions" :key="action.action">
          <div class="item separator disabled" v-if="action.separator">
            <hr />
          </div>
          <div :class="{ item: true, right: isRightAligned, disabled: action.disabled, wrap: action.wrap, selected: selected && action.action && selected.action === action.action }" :data-action="action.action" @click="onAction(action)" @mousemove="onMouseMove(action)" v-else>
            <span v-if="typeof action.icon === 'string'" class="icon text">{{ action.icon }}</span>
            <component :is="action.icon" v-else-if="typeof action.icon === 'object'" class="icon" />
            {{ action.label }}
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">

import { ref, computed, onMounted, onUnmounted, nextTick, PropType } from 'vue'
import Overlay from '../components/Overlay.vue'
import { t } from '../services/i18n'

export type MenuAction = {
  label?: string
  disabled?: boolean
  separator?: boolean
  action?: string|null
  icon?: string | object
  wrap?: boolean
}

export type MenuPosition = 'below' | 'above' | 'right' | 'above-right'

const props = defineProps({
  actions: Array<MenuAction>,
  selected: {
    type: Object as () => MenuAction | null,
    default: null
  },
  position: {
    type: String as PropType<MenuPosition>,
    default: 'below',
  },
  x: {
    type: Number,
    required: true
  },
  y: {
    type: Number,
    required: true
  },
  showFilter: {
    type: Boolean,
    default: false
  },
  teleport: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close', 'action-clicked'])

const list = ref(null)
const filter = ref('')
const selected = ref(null)

const visibleActions = computed(() => {
  if (props.showFilter && filter.value?.length) {
    return props.actions?.filter(action => action.label.toLowerCase().includes(filter.value.toLowerCase()));
  } else {
    return props.actions
  }
})

const position = computed(() => {
  if (props.position === 'right') {
    return {
      top: props.y + 'px',
      right: props.x + 'px'
    }
  } else if (props.position === 'above') {
    return {
      left: props.x + 'px',
      bottom: props.y + 'px'
    }
  } else if (props.position === 'above-right') {
    return {
      right: props.x + 'px',
      bottom: props.y + 'px'
    }
  } else if (props.position === 'below') {
    return {
      top: props.y + 'px',
      left: props.x + 'px',
    }
  } else {
    return {
      top: props.y + 'px',
      left: props.x + 'px'
    }
  }
});

const isRightAligned = computed(() => {
  return props.position === 'right' || props.position === 'above-right'
});

onMounted(() => {
  if (props.showFilter) {
    const input = document.querySelector<HTMLElement>('.context-menu input')
    input?.focus()
  }
  selected.value = props.selected || null
  
  document.addEventListener('keydown', onKeyUp)
  document.addEventListener('keyup', onKeyDown)
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyUp)
  document.removeEventListener('keyup', onKeyDown)
})

const onOverlay = () => {
  emit('close')
}

const onMouseMove = (action: MenuAction) => {
  selected.value = action.disabled ? null : action
  ensureVisible()
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const enabledActions = visibleActions.value.filter(action => !action.disabled);
    const index = enabledActions.map(a => a.action).indexOf(selected.value?.action)
    if (index === -1) {
      selected.value = enabledActions[0];
    } else {
      const currentIndex = enabledActions.findIndex(action => action.action === selected.value?.action);
      if (event.key === 'ArrowDown') {
      selected.value = enabledActions[(currentIndex + 1) % enabledActions.length];
      } else {
      selected.value = enabledActions[(currentIndex - 1 + enabledActions.length) % enabledActions.length];
      }
    }
    ensureVisible()
  } else if (event.key === 'Enter') {
    if (selected.value) {
      event.preventDefault()
      event.stopPropagation()
      onAction(selected.value)
    }
  }
}
 
const onKeyUp = (event: KeyboardEvent) => {
 if (event.key === 'Escape') {
    emit('close')
    event.preventDefault()
    event.stopPropagation()
    return false
  }

  // select the only action when filtered
  if (visibleActions.value.length === 1) {
    selected.value = visibleActions.value[0]
  }
}

const onAction = (action: MenuAction) => {
  if (!action.disabled) {  
    emit('action-clicked', action.action)
  }
};

const ensureVisible = () => {
  nextTick(() => {
    const selectedEl = list.value?.querySelector('.selected') as HTMLElement
    if (selectedEl) {
      scrollToBeVisible(selectedEl, list.value)
    }
  })
}

const scrollToBeVisible = function (ele: HTMLElement, container: HTMLElement) {
  const eleTop = ele.offsetTop - container.offsetTop;
  const eleBottom = eleTop + ele.clientHeight;

  const containerTop = container.scrollTop;
  const containerBottom = containerTop + container.clientHeight;

  if (eleTop < containerTop) {
    // Scroll to the top of container
    container.scrollTop -= containerTop - eleTop;
  } else if (eleBottom > containerBottom) {
    // Scroll to the bottom of container
    container.scrollTop += eleBottom - containerBottom;
  }
};

</script>


<style scoped>

.context-menu {
  -webkit-app-region: no-drag;
  position: absolute;
  background: var(--context-menu-bg-color);
  border: 1px solid var(--context-menu-border-color);
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
  max-height: 400px;
  max-width: 270px;
  border-radius: 0.5rem;
  overflow: hidden;
  z-index: 50;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
}

.context-menu .actions {
  flex: 1;
  width: 100%;
  overflow-y: auto;
  padding-right: 21px;
  display: flex;
  flex-direction: column;
  margin: 0px !important;
}

.context-menu .item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 11pt;
  white-space: nowrap;
  overflow-x: clip;
  text-overflow: ellipsis;
  color: var(--context-menu-text-color);
}

.context-menu .item.wrap {
  white-space: normal;
}

.context-menu .item.right {
  text-align: right;
}

.context-menu .item.separator {
  cursor: default;
  padding: 2px 0px 2px 8px;
}

.context-menu .item.separator hr {
  border-top-width: 0.5px;
  border-bottom-width: 0.5px;
}

.context-menu .item .icon {
  margin-right: 0.25rem;
}

.context-menu .item .icon.text {
  font-size: 11pt;
}

.context-menu .item.disabled {
  color: gray;
}

.context-menu .item.selected {
  background-color: var(--context-menu-selected-bg-color);
  color: var(--context-menu-selected-text-color);
  border-radius: 0.375rem;
}

.filter {
  
  position: static;
  margin-bottom: 0.5rem;
  width: calc(100% - 18px);

  input {
    background-color: var(--context-menu-filter-bg-color);
    color: var(--context-menu-filter-text-color);
    border-radius: 0.5rem;
    padding: 0.5rem;
    font-size: 11pt;

    &:focus {
      outline: none;
    }
  }
}

</style>