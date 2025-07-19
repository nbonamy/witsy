
<template>
  <div v-for="agents in [runnableAgents, supportAgents]" :set="type = agents[0]?.type":key="type">
    <div class="agents panel" v-if="agents.length">
      <div class="panel-header">
        <label>{{ t(`agent.forge.list.${type}`) }}</label>
        <BIconPlusLg class="icon create" @click.prevent="$emit('create')" />
      </div>
      <div class="panel-body" v-if="agents.length">
        <template v-for="agent in agents" :key="agent.uuid">
          <div class="panel-item" @click="$emit('view', agent)">
            <div class="info">
              <div class="text">{{ agent.name }}</div>
              <div class="subtext">{{ agent.name }}</div>
            </div>
            <div class="actions">
              <BIconPlayCircle v-if="type === 'runnable'" class="run" @click.prevent.stop="$emit('run', agent)" />
              <BIconSearch class="edit" @click.prevent.stop="$emit('view', agent)" />
              <BIconTrash class="delete" @click.prevent.stop="$emit('delete', agent)" />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { Agent } from '../types/index'
import { computed, PropType } from 'vue'
import { t } from '../services/i18n'

let type: string = ''

const emit = defineEmits(['create', 'view', 'run', 'delete']) 

const runnableAgents = computed(() => {
  return props.agents.filter(agent => agent.type === 'runnable')
})

const supportAgents = computed(() => {
  return props.agents.filter(agent => agent.type === 'support')
})

const props = defineProps({
  agents: Array as PropType<Agent[]>,
})

</script>

<style scoped>

.agents {
  font-size: 110%;

  .create {
    transform: scale(1.125);
  }

}



</style>