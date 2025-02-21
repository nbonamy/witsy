<template>
  <dialog class="editor">
    <form method="dialog">
      <header>
        <div class="title">Expert details</div>
      </header>
      <main>
        <div class="group">
          <label>Name</label>
          <input type="text" v-model="name" required />
        </div>
        <div class="group">
          <label>Prompt</label>
          <textarea v-model="prompt" required :disabled="isSystem"></textarea>
        </div>
        <div class="group" v-if="isSystem">
          <label></label>
          <div>System Experts cannot be edited. Make a copy to customize this expert.</div>
        </div>
        <div class="group" v-if="supportTriggerApps">
          <label>Trigger Apps</label>
          <div class="subgroup list-with-actions">
            <div class="list">
              <template v-for="app in triggerApps" :key="app.identifier">
              <div :class="{ item: true, selected: app.identifier == selectedApp?.identifier }" @click="selectApp(app)">
                <img class="icon" :src="iconData(app)" />
                <div class="name">{{ app.name }}</div>
              </div>
            </template>
            </div>
            <div class="actions">
              <button class="button add" @click.prevent="onAddApp"><BIconPlus /></button>
              <button class="button del" @click.prevent="onDelApp"><BIconDash /></button>
            </div>
            <span v-pre>The prompt will be automatically selected when Prompt Anywhere is called from one of these applications</span>
          </div>
        </div>
      </main>
      <footer>
        <button @click="onSave" class="default">Save</button>
        <button @click="onCancel" formnovalidate>Cancel</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">

import { Expert, ExternalApp } from 'types/index'
import { ref, computed, watch } from 'vue'
import Dialog from '../composables/dialog'

const emit = defineEmits(['expert-modified']);

const props = defineProps<{
  expert: Expert|null
}>()

const type = ref(null)
const name = ref(null)
const prompt = ref(null)
const triggerApps = ref(null)
const selectedApp = ref(null)

const isSystem = computed(() => type.value == 'system')

const supportTriggerApps = computed(() => window.api.platform == 'darwin')

const iconData = (app: ExternalApp) => {
  const iconContents = window.api.file.readIcon(app.icon)
  return `data:${iconContents.mimeType};base64,${iconContents.contents}`
}

const load = () => {
  type.value = props.expert?.type || 'user'
  name.value = props.expert?.name || ''
  prompt.value = props.expert?.prompt || ''
  triggerApps.value = props.expert?.triggerApps || []
}

const selectApp = (app: ExternalApp) => {
  selectedApp.value = app
}

const onAddApp = () => {
  const app = window.api.file.pick({ packages: true, location: true })
  const info = window.api.file.getAppInfo(app as string)
  triggerApps.value.push(info)
}

const onDelApp = () => {
  triggerApps.value = triggerApps.value.filter((app: ExternalApp) => app.identifier != selectedApp.value.identifier)
  selectedApp.value = null
}

// not really sure this is how it supposed to be done
// but at least it works!
watch(() => props.expert || {}, load, { immediate: true })

const onCancel = () => {
  load()
}

const onSave = (event: Event) => {

  // check
  if (!name.value || !prompt.value) {
    event.preventDefault()
    Dialog.alert('All fields marked with * are required.')
    return
  }

  // save it
  emit('expert-modified', {
    id: props.expert.id,
    name: name.value,
    prompt: prompt.value,
    triggerApps: triggerApps.value
  })
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
@import '../../css/list-with-actions.css';
</style>

<style scoped>

dialog.editor form .group input.icon {
  flex: 0 0 32px;
  text-align: center;
}

dialog.editor form .group input.shortcut {
  flex: 0 0 32px;
  text-align: center;
  text-transform: uppercase;
}

.windows dialog.editor .icon {
  font-family: 'NotoColorEmojiLimited';
  font-size: 9pt;
}

.list-with-actions {

  .list {

    height: 80px;
    overflow-y: auto;

    .item {

      display: flex;
      flex-direction: row;
      align-items: center;
      align-self: stretch;
      padding: 4px 8px;

      .icon {
        height: 24px;
        width: 24px;
        margin-right: 8px;
      }

      &.selected {
        background-color: var(--highlight-color);
        color: var(--highlighted-color);
      }
    }
  }
}

</style>