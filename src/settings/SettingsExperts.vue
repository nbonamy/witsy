<template>
  <div class="experts tab-content"  @keyup.escape.prevent="onEdit(null)">
    <header v-if="edited">
      <BIconChevronLeft class="icon back" @click="onEdit(null)" />
      <div class="title">{{ edited.name || expertI18n(edited, 'name') }}</div>
    </header>
    <header v-else>
      <div class="title">{{ t('settings.tabs.experts') }}</div>
    </header>
    <main class="sliding-root" :class="{ visible: !edited }">
      <ExpertsList ref="list" @edit="onEdit" @create="onCreate" />
    </main>
    <main class="editor sliding-pane" :class="{ visible: edited }"> 
      <ExpertEditor ref="editor" :expert="edited" @expert-modified="onExpertModified"/>
    </main>
  </div>
</template>

<script setup lang="ts">

import { Expert } from '../types/index'
import { ref } from 'vue'
import { store } from '../services/store'
import { expertI18n, t } from '../services/i18n'
import { newExpert, saveExperts } from '../services/experts'
import { v4 as uuidv4 } from 'uuid'
import ExpertsList from '../components/ExpertsList.vue'
import ExpertEditor from '../components/ExpertEditor.vue'

const list = ref(null)
const editor = ref(null)
const selected = ref<Expert>(null)
const edited = ref<Expert>(null)

const onCreate = (current: Expert) => {
  selected.value = current
  edited.value =  newExpert()
}

const onEdit = (expert: Expert) => {
  selected.value = null
  edited.value = expert
}

const onExpertModified = (payload: Expert) => {

  // cancel
  if (!payload) {
    edited.value = null
    return
  }
  
  // new expert?
  let expert = null
  if (payload.id == null) {

    // create a new ome
    expert = newExpert()
    expert.id = uuidv4()
    
    // find the index of the currently selected
    const selectedIndex = store.experts.findIndex(p => p.id === selected.value?.id)
    if (selectedIndex !== -1) {
      store.experts.splice(selectedIndex, 0, expert)
    } else {
      store.experts.push(expert)
    }
    
  } else {
    expert = store.experts.find(expert => expert.id == payload.id)
  }

  // update
  if (expert) {
    expert.name = payload.name
    expert.prompt = payload.prompt
    expert.triggerApps = payload.triggerApps
  }

  // done
  edited.value = null
  saveExperts()
  load()
}

const load = () => {
  list.value.load()
}

defineExpose({ load })

</script>


<style scoped>

</style>
