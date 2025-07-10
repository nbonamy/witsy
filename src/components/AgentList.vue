
<template>
  <div v-for="agents in [primaryAgents, secondaryAgents]" :set="type = agents[0]?.primary ? 'primary' : 'secondary'":key="type">
    <div class="agents list-large-with-header" v-if="agents.length">
      <div class="header">
        <label>{{ t(`agent.forge.list.${type}`) }}</label>
        <BIconPlusLg class="icon create" @click.prevent="$emit('create')" />
      </div>
      <div class="list" v-if="agents.length">
        <template v-for="agent in agents" :key="agent.uuid">
          <div class="item" @click="$emit('view', agent)">
            <div class="info">
              <div class="text">{{ agent.name }}</div>
              <div class="subtext">{{ agent.name }}</div>
            </div>
            <div class="actions">
              <BIconPlay v-if="type === 'primary'" class="run" @click.prevent.stop="$emit('run', agent)" />
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

const primaryAgents = computed(() => {
  return props.agents.filter(agent => agent.primary)
})

const secondaryAgents = computed(() => {
  return props.agents.filter(agent => !agent.primary)
})

const props = defineProps({
  agents: Array as PropType<Agent[]>,
})

</script>

<style scoped>
@import '../../css/list-large-with-header.css';
</style>

<style scoped>

.agents {
  font-size: 110%;

  .run {
    transform: scale(1.66);
  }
}



</style>