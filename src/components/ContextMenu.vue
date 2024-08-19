<template>
  <Teleport to="body" :disabled="!teleport">
    <div class="context-menu" :style="position">
      <form v-if="showFilter"><div class="group"><input v-model="filter" placeholder="Search…" autofocus="true" /></div></form>
      <div class="actions">
        <div v-for="action in visibleActions" :key="action.action" :class="{ item: true, disabled: action.disabled }" @click="onAction(action)">
          <span v-if="typeof action.icon === 'string'" class="icon text">{{ action.icon }}</span>
          <component :is="action.icon" v-else-if="typeof action.icon === 'object'" class="icon" />
          {{ action.label }}
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>

import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  actions: Object,
  align: String,
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
    return props.actions.filter(action => action.label.toLowerCase().includes(filter.value.toLowerCase()));
  } else {
    return props.actions
  }
})

const position = computed(() => {
  if (props.align === 'right') {
    return {
      top: props.y + 'px',
      right: props.x + 'px'
    }
  } else if (props.align === 'bottom') {
    return {
      left: props.x + 'px',
      bottom: props.y + 'px'
    }
  } else if (props.align === 'bottom-right') {
    return {
      right: props.x + 'px',
      bottom: props.y + 'px'
    }
  } else {
    return {
      top: props.y + 'px',
      left: props.x + 'px'
    }
  }
});

onMounted(() => {
  if (props.showFilter) {
    const input = document.querySelector('.context-menu input');
    input?.focus();
  }
});

const onAction = (action) => {
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
  background: rgba(229, 229, 229, 96%);
  border: 1px solid #B9B9B9;
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
}

.context-menu .item {
  padding: 4px 12px;
  cursor: pointer;
  font-size: 10pt;
  white-space: nowrap;
  overflow-x: clip;
  text-overflow: ellipsis;
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
  background-color: #57A1FF;
  border-radius: 4px;
  color: white;
}

form {
  position: static;
}

form .group input {
  background-color: #DDDBDA;
  border-radius: 6px;

}

form .group input:focus {
  outline-width: 4px; 
}

</style>