
<template>
  <div class="agents-list">
    <div v-for="agents in [runnableAgents, supportAgents]" :set="type = agents[0]?.type":key="type">
      <div class="agents panel" v-if="agents.length">
        <div class="panel-header">
          <label>{{ t(`agent.forge.list.${type}`) }}</label>
          <BIconPlusLg 
            class="icon create" 
            v-tooltip="{ text: t('agent.help.create'), position: 'bottom-left' }" 
            @click.prevent="$emit('create')" 
          />
        </div>
        <div class="panel-body" v-if="agents.length">
          <template v-for="agent in agents" :key="agent.uuid">
            <div class="panel-item" @click="$emit('view', agent)">
              <div class="info">
                <div class="text">{{ agent.name }}</div>
                <div class="subtext">{{ agent.description }}</div>
              </div>
              <div class="actions">
                <BIconPlayCircle 
                  v-if="type === 'runnable'" 
                  class="run" 
                  v-tooltip="{ text: t('agent.help.run'), position: 'top-left' }" 
                  @click.stop="$emit('run', agent)" 
                />
                <BIconSearch 
                  class="view" 
                  v-tooltip="{ text: t('agent.help.view'), position: 'top-left' }" 
                  @click.stop="$emit('view', agent)" 
                />
                <BIconPencil 
                  class="edit" 
                  v-tooltip="{ text: t('agent.help.edit'), position: 'top-left' }" 
                  @click.stop="$emit('edit', agent)" 
                />
                <BIconTrash 
                  class="delete" 
                  v-tooltip="{ text: t('agent.help.delete'), position: 'top-left' }" 
                  @click.stop="$emit('delete', agent)" 
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { Agent } from '../types/index'
import { computed, PropType } from 'vue'
import { t } from '../services/i18n'

let type: string = ''

const emit = defineEmits(['create', 'view', 'edit', 'run', 'delete']) 

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

.agents-list {
  
  margin: 4rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;

  .agents {
    .create {
      transform: scale(1.125);
    }
  }

}

</style>