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
          <div class="subgroup">
            <textarea v-model="expert" required></textarea>
            <span v-pre>Text between quotes will be automatically selected to be easily modified</span>
          </div>
        </div>
        <div class="group" v-if="supportTriggerApps">
          <label>Trigger Apps</label>
          <div class="subgroup">
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

<script setup>

import { ref, computed, watch } from 'vue'

const emit = defineEmits(['expert-modified']);

const props = defineProps({
  expert: Object
})

const name = ref(null)
const expert = ref(null)
const triggerApps = ref(null)
const selectedApp = ref(null)

const supportTriggerApps = computed(() => window.api.platform == 'darwin')

const iconData = (app) => {
  const iconContents = window.api.file.readIcon(app.icon)
  return `data:${iconContents.mimeType};base64,${iconContents.contents}`
}

const load = () => {
  name.value = props.expert?.name || ''
  expert.value = props.expert?.prompt || ''
  triggerApps.value = props.expert?.triggerApps || []
}

const selectApp = (app) => {
  selectedApp.value = app
}

const onAddApp = () => {
  const app = window.api.file.pick({ packages: true, location: true })
  const info = window.api.file.getAppInfo(app)
  triggerApps.value.push(info)
}

const onDelApp = () => {
  triggerApps.value = triggerApps.value.filter(app => app.identifier != selectedApp.value.identifier)
  selectedApp.value = null
}

// not really sure this is how it supposed to be done
// but at least it works!
watch(() => props.expert || {}, load, { immediate: true })

const onCancel = () => {
  load()
}

const onSave = (event) => {

  // check
  if (!name.value || !expert.value) {
    event.preventDefault()
    alert('All fields marked with * are required.')
    return
  }

  // save it
  emit('expert-modified', {
    id: props.expert.id,
    name: name.value,
    prompt: expert.value,
    triggerApps: triggerApps.value
  })
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
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

.list {

  background-color: white;
  border: 1px solid #D5D4D3;
  border-bottom: 0px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-self: stretch;
  align-items: start;
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
      color: white;
    }
  }
}

.actions {
  display: flex;
  flex-direction: row;
  justify-content: start;
  align-self: stretch;
  background: linear-gradient(to bottom, #fafafa, #f5f5f5);
  border: 0.8px solid #b4b4b4;

  button {
    border: 0px;
    border-right: 0.8px solid #b4b4b4;
    border-radius: 0px;
    background-color: transparent;
    margin: 0px;
    font-size: 10pt;
    padding-bottom: 2px;

    &:active {
      background: linear-gradient(to bottom, #c0c0c0, #b5b5b5);
    }
  }
}

</style>