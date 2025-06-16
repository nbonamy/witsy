
<template>
  <div class="agents">
    <div class="agent" :class="{ selected: selected === agent }" v-for="agent in agents" :key="agent.id" @click="selectAgent(agent)" @contextmenu.prevent="showContextMenu($event, agent)">
      <div class="name">{{ agent.name }}</div>
      <div class="description">{{ agent.description }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Agent } from '../types/index'
import { PropType } from 'vue'

const emit = defineEmits(['select', 'menu']) 

defineProps({
  agents: Array as PropType<Agent[]>,
  selected: Object as PropType<Agent>,
})

const selectAgent = (agent: Agent) => {
  emit('select', agent)
}

const showContextMenu = (event: MouseEvent, agent: Agent) => {
  event.preventDefault()
  emit('menu', { event, agent })
}

</script>

<style scoped>

.agents {

  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  overflow-y: auto;
  height: calc(100vh - var(--create-panel-height) - var(--header-height) - var(--footer-height));

  .agent {

    margin: 2px 8px;
    margin-right: 16px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    border-radius: 8px;
    cursor: pointer;
    gap: 4px;

    &.selected {
      background-color: var(--sidebar-selected-color);
      color: var(--color-selected-text);
    }

    .name {
      font-weight: bold;
      font-size: 10.5pt;
    }

    .description {
      font-size: 9.5pt;
      max-height: 30px;
      text-overflow: ellipsis;
      overflow: hidden;
    }
  }

}

</style>