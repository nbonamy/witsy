<template>
  <div class="webapps tab-content" @keyup.escape.prevent="onEdit(null)">
    <header v-if="edited">
      <div class="title">{{ edited.name || t('webapps.edit') }}</div>
    </header>
    <header v-else>
      <div class="title">{{ t('settings.tabs.webapps') }}</div>
    </header>
    <main class="sliding-root" :class="{ visible: !edited }">
      <div class="list-actions">
        <div class="list-action new" @click.prevent="onCreate"><PlusIcon />{{ t('webapps.add') }}</div>
        <div class="list-action edit" @click.prevent="onEdit(selected)" v-if="selected"><PencilIcon />{{ t('common.edit') }}</div>
        <div class="list-action delete" @click.prevent="onDelete" v-if="selected"><Trash2Icon />{{ t('common.delete') }}</div>
      </div>

      <div class="webapps-list sticky-table-container">
        <table v-if="webapps && webapps.length > 0">
          <thead>
            <tr>
              <th class="enabled">{{ t('common.enabled') }}</th>
              <th class="icon">{{ t('webapps.icon') }}</th>
              <th class="name">{{ t('webapps.name') }}</th>
              <th class="url">{{ t('webapps.url') }}</th>
              <th class="move">{{ t('common.move') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="webapp in webapps"
              :key="webapp.id"
              :data-id="webapp.id"
              class="webapp"
              :class="{ selected: selected?.id === webapp.id }"
              @click="onSelect(webapp)"
              @dblclick="onEdit(webapp)"
              draggable="true"
              @dragstart="reorderWebapps.onDragStart"
              @dragover="reorderWebapps.onDragOver"
              @dragend="reorderWebapps.onDragEnd"
            >
              <td class="enabled">
                <input type="checkbox" class="sm" :checked="webapp.enabled" @click.stop="onToggleEnabled(webapp)" />
              </td>
              <td class="icon">
                <component :is="getWebappIcon(webapp.icon)" class="webapp-icon" />
              </td>
              <td class="name">{{ webapp.name }}</td>
              <td class="url">{{ webapp.url }}</td>
              <td class="move">
                <button @click.prevent.stop="onMoveDown(webapp)">▼</button>
                <button @click.prevent.stop="onMoveUp(webapp)">▲</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="no-webapps">
          {{ t('webapps.noApps') }}
        </div>
      </div>

      <div class="form eviction-setting">
        <div class="form-field">
          <label>{{ t('webapps.evictionDuration') }}</label>
          <input
            type="number"
            v-model.number="evictionMinutes"
            min="1"
            max="1440"
            @input="onEvictionChange"
          />
        </div>
      </div>
    </main>

    <main class="editor sliding-pane" :class="{ visible: edited }">
      <div class="form" v-if="edited">
        <div class="form-field">
          <label>{{ t('webapps.name') }}</label>
          <input type="text" v-model="edited.name" />
        </div>

        <div class="form-field">
          <label>{{ t('webapps.url') }}</label>
          <input type="url" v-model="edited.url" placeholder="https://example.com" />
        </div>

        <div class="form-field">
          <label>{{ t('webapps.icon') }}</label>
          <IconPicker v-model="edited.icon" />
        </div>

        <div class="form-field">
          <label>{{ t('webapps.enabled') }}</label>
          <input type="checkbox" v-model="edited.enabled" />
        </div>

        <div class="form-actions">
          <button class="cancel" @click="onCancel">{{ t('common.cancel') }}</button>
          <button class="save cta" @click="onSave">{{ t('common.save') }}</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">

import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'
import IconPicker from '../components/IconPicker.vue'
import Dialog from '../composables/dialog'
import useReorderTable from '../composables/reorder_table'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { WebApp } from '../types/workspace'
import { icons } from 'lucide-vue-next'

const webapps = ref<WebApp[]>([])
const selected = ref<WebApp | null>(null)
const edited = ref<WebApp | null>(null)
const evictionMinutes = ref(30)

const getWebappIcon = (iconName: string) => {
  return (icons as any)[iconName] || icons.Globe
}

const reorderWebapps = useReorderTable((ids: string[]) => {
  const reordered: WebApp[] = []
  ids.forEach(id => {
    const webapp = webapps.value.find(w => w.id === id)
    if (webapp) {
      reordered.push(webapp)
    }
  })
  webapps.value = reordered
  saveWebapps()
})

const onSelect = (webapp: WebApp) => {
  selected.value = selected.value?.id === webapp.id ? null : webapp
}

const onCreate = () => {
  edited.value = {
    id: '',
    name: '',
    url: '',
    icon: 'Globe',
    enabled: true
  }
}

const onEdit = (webapp: WebApp | null) => {
  if (!webapp) {
    edited.value = null
    return
  }
  edited.value = { ...webapp }
}

const onCancel = () => {
  edited.value = null
}

const onSave = () => {
  if (!edited.value) return

  // Validate
  if (!edited.value.name || !edited.value.url) {
    return
  }

  // New webapp
  if (!edited.value.id) {
    const newWebapp = { ...edited.value, id: uuidv4() }
    webapps.value.push(newWebapp)
  } else {
    // Update existing
    const existing = webapps.value.find(w => w.id === edited.value.id)
    if (existing) {
      Object.assign(existing, edited.value)
    }
  }

  saveWebapps()
  edited.value = null
}

const onDelete = async () => {
  if (!selected.value) return

  const result = await Dialog.show({
    title: t('webapps.delete'),
    text: t('webapps.deleteConfirm'),
    showCancelButton: true,
    confirmButtonText: t('common.delete')
  })

  if (result.isConfirmed) {
    webapps.value = webapps.value.filter(w => w.id !== selected.value.id)
    selected.value = null
    saveWebapps()
  }
}

const onToggleEnabled = (webapp: WebApp) => {
  webapp.enabled = !webapp.enabled
  saveWebapps()
}

const onMoveUp = (webapp: WebApp) => {
  if (reorderWebapps.moveUp(webapp, webapps.value, '.webapps-list')) {
    saveWebapps()
  }
}

const onMoveDown = (webapp: WebApp) => {
  if (reorderWebapps.moveDown(webapp, webapps.value, '.webapps-list')) {
    saveWebapps()
  }
}

const onEvictionChange = () => {
  store.config.general.webappEvictionMinutes = evictionMinutes.value
  store.saveSettings()
}

const saveWebapps = () => {
  store.workspace.webapps = webapps.value
  window.api.workspace.save(JSON.parse(JSON.stringify(store.workspace)))
}

const load = () => {
  webapps.value = [...(store.workspace?.webapps || [])]
  evictionMinutes.value = store.config.general.webappEvictionMinutes || 30
  selected.value = null
  edited.value = null
}

defineExpose({ load })

</script>

<style scoped>

.webapps-list {
  flex: 1;
  overflow-y: auto;

  table {
    width: 100%;

    th, td {
      text-align: left;
      padding: 0.5rem;
    }

    th.enabled, td.enabled {
      width: 60px;
      text-align: center;
    }

    th.icon, td.icon {
      width: 50px;
      text-align: center;
    }

    th.move, td.move {
      width: 80px;
      text-align: center;
    }

    td.icon .webapp-icon {
      width: 20px;
      height: 20px;
    }

    tbody tr {
      cursor: pointer;

      &.selected {
        background: var(--highlight-color);
      }

      &:hover {
        background: var(--control-button-hover-bg-color);
      }

      &.selected:hover {
        background: var(--highlight-color);
      }
    }

    td.move button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.25rem;
      color: var(--text-color);

      &:hover {
        color: var(--color-primary);
      }
    }
  }
}

.no-webapps {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary-color);
}

.eviction-setting {
  padding: 1rem;
  border-top: 1px solid var(--border-color);

  .form-field {
    max-width: 400px;

    input[type="number"] {
      width: 100px;
    }
  }
}

.editor {
  .form {
    padding: 1rem;

    .form-field {
      margin-bottom: 1rem;

      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
      }

      input[type="text"],
      input[type="url"] {
        width: 100%;
      }

      input[type="checkbox"] {
        width: auto;
      }
    }

    .form-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1.5rem;

      button {
        padding: 0.5rem 1rem;
      }
    }
  }
}

</style>
