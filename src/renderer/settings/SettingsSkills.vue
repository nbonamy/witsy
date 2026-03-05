<template>
  <div class="skills tab-content" @keyup.escape.prevent="onEdit(null)">
    <header v-if="edited">
      <div class="title">{{ edited.name || t('settings.tabs.skills') }}</div>
    </header>
    <header v-else>
      <div class="title">{{ t('settings.tabs.skills') }}</div>
    </header>
    <main class="sliding-root" :class="{ visible: !edited }">
      <SkillsList ref="list" @create="onCreate" @edit="onEdit" />
    </main>
    <main class="editor sliding-pane" :class="{ visible: edited }">
      <SkillEditor :skill="edited" :readonly="Boolean(edited?.readonly)" @skill-modified="onSkillModified" />
    </main>
  </div>
</template>

<script setup lang="ts">

import SkillEditor from '@components/SkillEditor.vue'
import SkillsList from '@components/SkillsList.vue'
import Dialog from '@renderer/utils/dialog'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { ref } from 'vue'

type SkillDraft = {
  id?: string
  name?: string
  description?: string
  instructions?: string
  rootPath?: string
  readonly?: boolean
}

const edited = ref<SkillDraft | null>(null)
const list = ref<{ load: () => void } | null>(null)

const onCreate = () => {
  edited.value = {
    name: '',
    description: '',
    instructions: '',
  }
}

const onEdit = (skill: SkillDraft | null) => {
  edited.value = skill
}

const onSkillModified = async (payload: SkillDraft | null) => {
  if (!payload) {
    edited.value = null
    return
  }

  if (payload.readonly) {
    edited.value = null
    return
  }

  let result
  if (payload.id) {
    result = window.api.skills.update(store.config.workspaceId, payload.id, {
      name: payload.name || '',
      description: payload.description || '',
      instructions: payload.instructions || '',
    })
  } else {
    result = window.api.skills.create(store.config.workspaceId, {
      name: payload.name || '',
      description: payload.description || '',
      instructions: payload.instructions || '',
    })
  }

  if (!result.success) {
    await Dialog.show({
      target: document.querySelector('.main'),
      title: t('common.error'),
      text: result.error || t('settings.plugins.skills.saveFailed'),
    })
    return
  }

  edited.value = null
  list.value?.load()
}

const load = () => {
  list.value?.load()
}

defineExpose({ load })

</script>

<style scoped>

</style>
