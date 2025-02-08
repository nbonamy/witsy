<template>
  <Teleport to="body" :disabled="!teleport">
    <Overlay @click="onOverlay" />
    <div class="context-menu" :style="position">
      <form v-if="showFilter"><div class="group filter"><input v-model="filter" placeholder="Search…" autofocus="true" /></div></form>
      <div class="actions">
        <template v-for="action in visibleActions" :key="action.action">
          <div class="item separator disabled" v-if="action.separator">
            <hr  />
          </div>
          <div :class="{ item: true, right: isRightAligned, disabled: action.disabled, wrap: action.wrap }" :data-action="action.action" @click="onAction(action)" v-else>
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

import { ref, computed, onMounted } from 'vue'
import Overlay from '../components/Overlay.vue'

export type MenuAction = {
  label?: string
  disabled?: boolean
  separator?: boolean
  action?: string|null
  icon?: string | object
  wrap?: boolean
}

const props = defineProps({
  actions: Array<MenuAction>,
  onClose: {
    type: Function,
    required: true,
  },
  position: String,
  x: Number,
  y: Number,
  showFilter: {
    type: Boolean,
    default: false
  },
  teleport: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['action-clicked'])

const filter = ref('')

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
      left: props.x + 'px',
      top: props.y + 'px'
    }
  } else {
    return {
      top: props.y + 'px',
      left: props.x + 'px'
    }
  }
});

const isRightAligned = computed(() => {
  return props.position === 'right' || props.position === 'above-right';
});

onMounted(() => {
  if (props.showFilter) {
    const input = document.querySelector<HTMLElement>('.context-menu input');
    input?.focus();
  }
});

const onOverlay = () => {
  props.onClose()
}

const onAction = (action: MenuAction) => {
  if (!action.disabled) {  
    emit('action-clicked', action.action)
  }
};

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

.context-menu {
  -webkit-app-region: no-drag;
  position: absolute;
  background: var(--context-menu-bg-color);
  border: 1px solid var(--context-menu-border-color);
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
  max-height: 400px;
  max-width: 270px;
  border-radius: 6px;
  overflow: hidden;
  z-index: 50;
  padding: 5px;
  display: flex;
  flex-direction: column;
}

.context-menu .actions {
  flex: 1;
  width: 100%;
  overflow-y: auto;
  padding-right: 20px;
  display: flex;
  flex-direction: column;
  margin-top: 0px;
}

.context-menu .item {
  padding: 4px 12px;
  cursor: pointer;
  font-size: 10pt;
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
  margin-right: 4px;
}

.context-menu .item .icon.text {
  font-size: 11pt;
}

.context-menu .item.disabled {
  color: gray;
}

.context-menu .item:not(.disabled):hover {
  background-color: var(--context-menu-selected-bg-color);
  color: var(--highlighted-color);
  border-radius: 4px;
}

form {
  position: static;
}

form .group input {
  background-color: var(--context-menu-filter-bg-color);
  color: var(--context-menu-filter-text-color);
  border-radius: 6px;

}

form .group input:focus {
  outline-width: 1px; 
}

</style>