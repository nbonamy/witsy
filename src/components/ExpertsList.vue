<template>
  <div class="list-filters form form-large">
    <input
      v-model="searchQuery"
      type="search"
      :placeholder="t('settings.experts.searchPlaceholder')"
      class="search-input"
    />
    <select v-model="categoryFilter" class="category-filter">
      <option value="">{{ t('settings.experts.allCategories') }}</option>
      <option v-for="cat in availableCategories" :key="cat.id" :value="cat.id">
        {{ getCategoryLabel(cat.id, store.expertCategories) }}
      </option>
    </select>
  </div>
  <div class="list-actions">
    <div class="list-action new" @click.prevent="onNew"><PlusIcon />{{ t('settings.experts.new') }}</div>
    <div class="list-action edit" @click.prevent="onEdit(selected)" v-if="selected"><PencilIcon />{{ t('common.edit') }}</div>
    <div class="list-action copy" @click.prevent="onCopy(selected)" v-if="selected"><CopyIcon />{{ t('settings.experts.copy') }}</div>
    <div class="list-action delete" @click.prevent="onDelete" v-if="selected"><Trash2Icon />{{ t('common.delete') }}</div>
    <div class="flex-push" />
    <ContextMenuTrigger class="list-action menu" position="below-right" ref="moreButton">
      <template #menu>
        <div class="item" @click="handleActionClick('export')">{{ t('settings.experts.export') }}</div>
        <div class="item" @click="handleActionClick('import')">{{ t('settings.experts.import') }}</div>
        <div class="item" @click="handleActionClick('select')">{{ t('settings.experts.enableAll') }}</div>
        <div class="item" @click="handleActionClick('unselect')">{{ t('settings.experts.disableAll') }}</div>
        <div class="item" @click="handleActionClick('deleteAll')">{{ t('settings.experts.deleteAll') }}</div>
        <div class="item" @click="handleActionClick('sortAlpha')">{{ t('settings.experts.sortAlpha') }}</div>
        <div class="item" @click="handleActionClick('sortEnabled')">{{ t('settings.experts.sortState') }}</div>
        <div class="item" @click="handleActionClick('sortUsage')">{{ t('settings.experts.sortUsage') }}</div>
      </template>
    </ContextMenuTrigger>
  </div>
  <div class="experts sticky-table-container">
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.field">{{ column.title }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="expert in filteredExperts" :key="expert.id" :data-id="expert.id" class="expert" :class="selected?.id == expert.id ? 'selected' : ''"
            @click="onSelect(expert)" @dblclick="onEdit(expert)" draggable="true" @dragstart="reorderExperts.onDragStart" @dragover="reorderExperts.onDragOver" @dragend="reorderExperts.onDragEnd">
          <td class="enabled"><input type="checkbox" class="sm" :checked="expert.state=='enabled'" @click="onEnabled(expert)" @dblclick.stop /></td>
          <td class="name">{{ name(expert) }}</td>
          <td class="category">{{ expert.categoryId ? getCategoryLabel(expert.categoryId, store.expertCategories) : '-' }}</td>
          <!-- <td class="usage">{{ expert.stats?.timesUsed || '-' }}</td> -->
          <td class="move">
            <button @click.prevent="onMoveDown(expert)" @dblclick.stop>▼</button>
            <button @click.prevent="onMoveUp(expert)" @dblclick.stop>▲</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">

import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import Dialog from '../composables/dialog'
import useReorderTable from '../composables/reorder_table'
import { getCategoryLabel } from '../services/categories'
import { newExpert, saveExperts } from '../services/experts'
import { expertI18n, t } from '../services/i18n'
import { store } from '../services/store'
import { Expert } from '../types/index'

const experts = ref<Expert[]>(null)
const selected = ref<Expert>(null)
const moreButton = ref<HTMLElement>(null)
const searchQuery = ref('')
const categoryFilter = ref<string>('')

const reorderExperts = useReorderTable((ids: string[]) => {
  experts.value.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  save()
})

const emit = defineEmits([ 'create', 'edit' ])

const availableCategories = computed(() => {
  const catIds = new Set<string>()
  experts.value?.forEach(e => {
    if (e.categoryId) catIds.add(e.categoryId)
  })
  return store.expertCategories.filter(c => catIds.has(c.id) && c.state === 'enabled')
})

const filteredExperts = computed(() => {
  let result = experts.value?.filter((expert: Expert) => expert.state != 'deleted') || []

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(expert => {
      const expertName = (expert.name || expertI18n(expert, 'name')).toLowerCase()
      // const description = (expert.description || expertI18n(expert, 'description') || '').toLowerCase()
      // const prompt = (expert.prompt || expertI18n(expert, 'prompt') || '').toLowerCase()
      // const categoryLabel = expert.categoryId ? getCategoryLabel(expert.categoryId, store.expertCategories).toLowerCase() : ''
      return expertName.includes(query)/* ||
             description.includes(query) ||
             prompt.includes(query) ||
             categoryLabel.includes(query)*/
    })
  }

  // Apply category filter
  if (categoryFilter.value) {
    result = result.filter(e => e.categoryId === categoryFilter.value)
  }

  return result
})

const name = (expert: Expert) => {
  return expert.name || expertI18n(expert, 'name')
}

const columns = [
  // { field: 'pin', title: '' },
  { field: 'enabled', title: '' },
  { field: 'name', title: t('common.name') },
  { field: 'category', title: t('common.category') },
  // { field: 'usage', title: t('settings.experts.usage') },
  { field: 'move', title: t('common.move'), },
]

const onMoveDown = (expert: Expert) => {
  if (reorderExperts.moveDown(expert, experts.value, '.settings .experts .sticky-table-container')) {
    save()
  }
}

const onMoveUp = (expert: Expert) => {
  if (reorderExperts.moveUp(expert, experts.value, '.settings .experts .sticky-table-container')) {
    save()
  }
}

const handleActionClick = async (action: string) => {

  // Get visible expert IDs (respects search and category filter)
  const visibleIds = new Set(filteredExperts.value.map(e => e.id))

  // process
  if (action === 'select') {
    experts.value.forEach((expert: Expert) => {
      if (visibleIds.has(expert.id) && expert.state === 'disabled') {
        expert.state = 'enabled'
      }
    })
    save()
  } else if (action === 'unselect') {
    experts.value.forEach((expert: Expert) => {
      if (visibleIds.has(expert.id) && expert.state === 'enabled') {
        expert.state = 'disabled'
      }
    })
    save()
  } else if (action === 'import') {
    onImport()
  } else if (action === 'export') {
    onExport()
  } else if (action === 'deleteAll') {
    deleteAll(visibleIds)
  } else if (action === 'sortAlpha') {
    experts.value.sort((a, b) => {
      const aName = a.name || expertI18n(a, 'name')
      const bName = b.name || expertI18n(b, 'name')
      return aName.localeCompare(bName)
    })
    save()
  } else if (action === 'sortEnabled') {
    experts.value.sort((a, b) => {
      if (a.state === b.state) {
        const aName = a.name || expertI18n(a, 'name')
        const bName = b.name || expertI18n(b, 'name')
        return aName.localeCompare(bName)
      } else {
        // disabled < enabled
        return b.state.localeCompare(a.state)
      }
    })
    save()
  } else if (action === 'sortUsage') {
    experts.value.sort((a, b) => {
      const aUsage = a.stats?.timesUsed || 0
      const bUsage = b.stats?.timesUsed || 0
      return bUsage - aUsage  // Descending
    })
    save()
  }

}

const onImport = () => {
  if (window.api.experts.import(store.config.workspaceId)) {
    store.loadExperts()
    load()
    Dialog.alert(t('settings.experts.importSuccess'))
  } else {
    Dialog.alert(t('settings.experts.importError'))
  }
}

const onExport = () => {
  if (window.api.experts.export(store.config.workspaceId)) {
    Dialog.alert(t('settings.experts.exportSuccess'))
  } else {
    Dialog.alert(t('settings.experts.exportError'))
  }
}

const onSelect = (expert: Expert) => {
  selected.value = expert
}

const onNew = () => {
  emit('create', selected.value)
}

const onCopy = (expert: Expert) => {

  const copy = newExpert()
  copy.id = uuidv4()
  copy.name = (expert.name || expertI18n(expert, 'name')) + ' (' + t('settings.experts.copy') + ')'
  copy.prompt = expert.prompt || expertI18n(expert, 'prompt')
  copy.description = expert.description || expertI18n(expert, 'description')
  copy.categoryId = expert.categoryId
  copy.triggerApps = expert.triggerApps

  const index = experts.value.indexOf(expert)
  experts.value.splice(index + 1, 0, copy)

  selected.value = copy
  save()

}

const onEdit = (expert: Expert) => {
  emit('edit', expert)
}

const onDelete = () => {
  Dialog.show({
    target: document.querySelector('.settings .experts'),
    title: t('settings.experts.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      if (selected.value.type == 'system') {
        selected.value.state = 'deleted'
      } else {
        const index = experts.value.indexOf(selected.value)
        experts.value.splice(index, 1)
      }
      selected.value = null
      save()
    }
  })
}

const deleteAll = (visibleIds: Set<string>) => {
  Dialog.show({
    target: document.querySelector('.settings .experts'),
    title: t('settings.experts.confirmDeleteAll'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      // Mark visible system experts as deleted
      experts.value.forEach((expert: Expert) => {
        if (visibleIds.has(expert.id) && expert.type == 'system') {
          expert.state = 'deleted'
        }
      })
      // Remove visible user experts
      experts.value = experts.value.filter((expert: Expert) =>
        expert.type === 'system' || !visibleIds.has(expert.id)
      )
      selected.value = null
      save()
    }
  })
}

const onEnabled = (expert: Expert) => {
  expert.state = (expert.state == 'enabled' ? 'disabled' : 'enabled')
  save()
}

const load = () => {
  experts.value = JSON.parse(JSON.stringify(store.experts))
}

const save = () => {
  store.experts = experts.value
  saveExperts(store.config.workspaceId)
}

defineExpose({ load })

</script>


<style scoped>

.list-filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  overflow: visible;
}

.search-input {
  flex: 1;
}

.category-filter {
  min-width: 150px;
}

.experts {
  border: 0.5px solid var(--border-color);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  font-weight: 600;
  background: var(--background-secondary);
}

.section-header .icon {
  width: 16px;
  height: 16px;
  color: var(--color-primary);
}

.pin button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.category, .usage {
  text-align: center;
}

</style>
