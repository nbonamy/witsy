<template>
  <div>
    <div class="webapps-description">
      {{ t('webapps.description') }}
    </div>

    <div class="list-actions">
      <div class="list-action new" @click.prevent="onNew"><PlusIcon />{{ t('webapps.add') }}</div>
      <div class="list-action edit" @click.prevent="onEdit(selected)" v-if="selected"><PencilIcon />{{ t('common.edit') }}</div>
      <div class="list-action copy" @click.prevent="onCopy(selected)" v-if="selected"><CopyIcon />{{ t('common.copy') }}</div>
      <div class="list-action delete" @click.prevent="onDelete" v-if="selected"><Trash2Icon />{{ t('common.delete') }}</div>
    </div>

    <div class="webapps sticky-table-container">
      <table v-if="webapps && webapps.length > 0">
        <thead>
          <tr>
            <th class="enabled">{{ t('common.enabled') }}</th>
            <th class="icon">{{ t('webapps.icon') }}</th>
            <th class="name">{{ t('webapps.name') }}</th>
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
              <input type="checkbox" class="sm" :checked="webapp.enabled" @click.stop="onToggleEnabled(webapp)" @dblclick.stop />
            </td>
            <td class="icon">
              <img v-if="!webapp.icon" :src="`https://s2.googleusercontent.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(webapp.url)}`" class="webapp-favicon" alt="Webapp icon" />
              <component v-else :is="getWebappIcon(webapp.icon)" class="webapp-icon" />
            </td>
            <td class="name">{{ webapp.name }}</td>
            <td class="move">
              <button @click.prevent="onMoveDown(webapp)" @dblclick.stop>▼</button>
              <button @click.prevent="onMoveUp(webapp)" @dblclick.stop>▲</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-webapps">
        {{ t('webapps.noApps') }}
      </div>
    </div>

    <div class="form form-vertical form-large eviction-setting">
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
  </div>
</template>

<script setup lang="ts">

import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import Dialog from '../composables/dialog'
import useReorderTable from '../composables/reorder_table'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { WebApp } from '../types/workspace'
import { icons } from 'lucide-vue-next'

const emit = defineEmits(['edit', 'create'])

const webapps = ref<WebApp[]>([])
const selected = ref<WebApp | null>(null)
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

const onNew = () => {
  emit('create', selected.value)
}

const onEdit = (webapp: WebApp | null) => {
  if (!webapp) return
  emit('edit', webapp)
}

const onCopy = (webapp: WebApp) => {
  if (!webapp) return

  const copy: WebApp = {
    ...webapp,
    id: uuidv4(),
    name: `${webapp.name} (copy)`
  }

  webapps.value.push(copy)
  saveWebapps()
  load()
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
  if (reorderWebapps.moveUp(webapp, webapps.value, '.webapps')) {
    saveWebapps()
  }
}

const onMoveDown = (webapp: WebApp) => {
  if (reorderWebapps.moveDown(webapp, webapps.value, '.webapps')) {
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
}

defineExpose({ load })

</script>

<style scoped>

.webapps-description {
  margin-bottom: 2rem;
  font-size: 15px;
  line-height: 1.5;
}

.webapps {

  border: 0.5px solid var(--border-color);

  td {
    padding: 0.25rem 0.75rem;
    vertical-align: middle;
  }


  td.icon {
    width: 1.5rem;
    .webapp-icon {
      margin-top: 5px;
      width: 1rem;
      height: 1rem;
    }
    .webapp-favicon {
      margin-top: 5px;
      width: 1rem;
      height: 1rem;
    }
  }
}

.no-webapps {
  padding: 4rem 2rem;
  text-align: center;
  border: 1px solid var(--border-color);
  font-size: 15px;
}

.eviction-setting {
  margin-top: 2rem;

  .form-field {
    input[type="number"] {
      width: 100px;
    }
  }
}

</style>
