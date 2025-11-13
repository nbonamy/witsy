<template>

  <CategoryManager
    v-if="showCategoryManager"
    :workspace="workspace"
    @update="onCategoriesUpdate"
    @close="closeCategoryManager"
  />

  <div class="list-with-toolbar" v-else>

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
          {{ cat.name }}
        </option>
      </select>
    </div>

    <div class="toolbar" v-if="filteredExperts.length > 0">
      <div class="functional-controls">
        <div class="item-count">
          <input type="checkbox" v-model="allSelected" @change="onToggleAll" />
          <span>{{ selectedExperts.length > 0 ? t('settings.experts.itemsSelected', { count: selectedExperts.length }) : t('settings.experts.itemCount', { count: filteredExperts.length }) }}</span>
        </div>
        <div class="actions">

          <button type="button" class="primary" name="new" @click="onNew" v-if="selectedExperts.length === 0"><PlusIcon />{{ t('settings.experts.new') }}</button>
          <button type="button" class="primary" name="copy" @click="onCopy" v-if="selectedExperts.length === 1"><PlusIcon />{{ t('common.copy') }}</button>
          <button type="button" class="secondary" name="toggle" @click="onToggle" v-if="selectedExperts.length"><ListTodoIcon />{{ t('settings.experts.toggle') }}</button>
          <button type="button" class="secondary" name="delete" @click="onDelete" v-if="selectedExperts.length"><Trash2Icon />{{ t('common.delete') }}</button>

        </div>
      </div>

      <div class="actions">

        <ContextMenuTrigger class="sort-button" position="below-right" :bordered="true">
          <template #trigger>
            <div class="button sort">{{ t('settings.experts.sortAlpha') }}<ChevronDownIcon /></div>
          </template>
          <template #menu>
            <div class="item" @click="handleActionClick('sortAlpha')">{{ t('settings.experts.sortAlpha') }}</div>
            <div class="item" @click="handleActionClick('sortEnabled')">{{ t('settings.experts.sortState') }}</div>
          </template>
        </ContextMenuTrigger>


        <ContextMenuTrigger class="toolbar-menu" position="below-right" :bordered="true">
          <template #menu>
            <div class="item" @click="handleActionClick('manageCategories')">{{ t('settings.experts.manageCategories') }}</div>
            <!-- <div class="item" @click="handleActionClick('export')">{{ t('settings.experts.export') }}</div>
            <div class="item" @click="handleActionClick('import')">{{ t('settings.experts.import') }}</div>
            <div class="item" @click="handleActionClick('select')">{{ t('settings.experts.enableAll') }}</div>
            <div class="item" @click="handleActionClick('unselect')">{{ t('settings.experts.disableAll') }}</div>
            <div class="item" @click="handleActionClick('deleteAll')">{{ t('settings.experts.deleteAll') }}</div> -->
          </template>
        </ContextMenuTrigger>

      </div>
    </div>

    <table class="table-plain" v-if="filteredExperts.length > 0">
      <thead>
        <tr>
          <th>{{ t('common.name') }}</th>
          <!-- <th>{{ t('common.category') }}</th> -->
          <th>{{ t('common.status') }}</th>
          <th>{{ t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="expert in filteredExperts" :key="expert.id" :data-id="expert.id" class="expert" :class="{ selected: selectedExperts.includes(expert.id) }"
            draggable="true" @dragstart="reorderExperts.onDragStart" @dragover="reorderExperts.onDragOver" @dragend="reorderExperts.onDragEnd">
          <td class="name">
            <div>
              <input type="checkbox" :value="expert.id" v-model="selectedExperts" />
              <BrainIcon />
              {{ name(expert) }}
            </div>
          </td>
          <!-- <td class="category">{{ expert.categoryId ? categoryI18n(getCategory(expert), 'name') : '-' }}</td> -->
          <td class="enabled">
            <ButtonSwitch :checked="expert.state=='enabled'" @change="() => onEnabled(expert)" />
          </td>
          <td>
            <div class="actions">
              <ButtonIcon class="edit" @click="onEdit(expert)"><PencilIcon /></ButtonIcon>
              <ContextMenuTrigger position="above-right">
                <template #menu>
                  <div class="item" @click="onDeleteSingle(expert)">{{ t('common.delete') }}</div>
                  <div class="item" @click="onMoveUp(expert)">{{ t('common.moveUp') }}</div>
                  <div class="item" @click="onMoveDown(expert)">{{ t('common.moveDown') }}</div>
                </template>
              </ContextMenuTrigger>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="empty-state" v-if="filteredExperts.length === 0">
      <p>{{ t('settings.experts.empty') }}</p>
      <button type="button" class="primary" @click="onNew">
        <PlusIcon />
        {{ t('settings.experts.new') }}
      </button>
    </div>
  </div>

</template>

<script setup lang="ts">

import { BrainIcon, ChevronDownIcon, ListTodoIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { computed, onMounted, ref, watch } from 'vue'
import ButtonIcon from '../components/ButtonIcon.vue'
import CategoryManager from '../components/CategoryManager.vue'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import Dialog from '../utils/dialog'
import useReorderTable from '../composables/reorder_table'
import { newExpert } from '../services/experts'
import { categoryI18n, expertI18n, t } from '../services/i18n'
import { Expert, ExpertCategory } from 'types/index'
import { Workspace } from 'types/workspace'
import ButtonSwitch from './ButtonSwitch.vue'

const props = defineProps<{
  workspace: Workspace
}>()

const emit = defineEmits<{
  'create': []
  'edit': [ Expert ]
  'save': []
}>()

const experts = ref<Expert[]>(null)
const categories = ref<ExpertCategory[]>([])
const selectedExperts = ref<string[]>([])
const searchQuery = ref('')
const categoryFilter = ref<string>('')
const showCategoryManager = ref(false)
const currentSort = ref<'alpha' | 'enabled'>('alpha')

onMounted(() => {
  load()
})

const reorderExperts = useReorderTable((ids: string[]) => {
  experts.value.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  save()
})

const allCategories = computed(() => {
  return categories.value.filter(c => c.state === 'enabled')
})

const availableCategories = computed(() => {
  const catIds = new Set<string>()
  experts.value?.forEach(e => {
    if (e.categoryId) {
      catIds.add(e.categoryId)
    }
  })
  return categories.value.filter(c => catIds.has(c.id) && c.state === 'enabled').map((c: ExpertCategory) => ({
    id: c.id,
    name: categoryI18n(c, 'name')
  })).sort((a, b) => a.name.localeCompare(b.name))
})

const filteredExperts = computed(() => {
  let result = experts.value?.filter((expert: Expert) => expert.state != 'deleted') || []

  // Hide experts with disabled categories
  const enabledCategoryIds = new Set(
    categories.value
      .filter(c => c.state === 'enabled')
      .map(c => c.id)
  )
  result = result.filter(e => !e.categoryId || enabledCategoryIds.has(e.categoryId))

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

// Clear category filter if selected category becomes disabled
watch(() => categories.value, () => {
  if (categoryFilter.value) {
    const selectedCat = categories.value.find(c => c.id === categoryFilter.value)
    if (!selectedCat || selectedCat.state !== 'enabled') {
      categoryFilter.value = ''
    }
  }
}, { deep: true })

const allSelected = computed({
  get: () => selectedExperts.value.length === filteredExperts.value.length && filteredExperts.value.length > 0,
  set: (value: boolean) => {
    if (value) {
      selectedExperts.value = filteredExperts.value.map(e => e.id)
    } else {
      selectedExperts.value = []
    }
  }
})

const onToggleAll = () => {
  // Handled by computed setter
}
const onToggle = () => {
  if (selectedExperts.value.length === 0) return

  // Get the first selected expert
  const firstExpert = experts.value.find(e => e.id === selectedExperts.value[0])
  if (!firstExpert) return

  // If first expert is enabled, disable all selected; otherwise enable all
  const targetState = firstExpert.state === 'enabled' ? 'disabled' : 'enabled'

  selectedExperts.value.forEach(id => {
    const expert = experts.value.find(e => e.id === id)
    if (expert) {
      expert.state = targetState
    }
  })

  save()
}

const name = (expert: Expert) => {
  return expert.name || expertI18n(expert, 'name')
}

const getCategory = (expert: Expert): ExpertCategory => {
  return categories.value.find(c => c.id === expert.categoryId)
}

const onMoveDown = (expert: Expert) => {
  if (reorderExperts.moveDown(expert, experts.value, '.settings .experts table')) {
    save()
  }
}

const onMoveUp = (expert: Expert) => {
  if (reorderExperts.moveUp(expert, experts.value, '.settings .experts table')) {
    save()
  }
}

const handleActionClick = async (action: string) => {

  // Get visible expert IDs (respects search and category filter)
  const visibleIds = new Set(filteredExperts.value.map(e => e.id))

  // process
  if (action === 'manageCategories') {
    showCategoryManager.value = true
  } else if (action === 'select') {
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
    currentSort.value = 'alpha'
    experts.value.sort((a, b) => {
      const aName = a.name || expertI18n(a, 'name')
      const bName = b.name || expertI18n(b, 'name')
      return aName.localeCompare(bName)
    })
    save()
  } else if (action === 'sortEnabled') {
    currentSort.value = 'enabled'
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
  if (window.api.experts.import(props.workspace.uuid)) {
    load()
    Dialog.alert(t('settings.experts.importSuccess'))
  } else {
    Dialog.alert(t('settings.experts.importError'))
  }
}

const onExport = () => {
  if (window.api.experts.export(props.workspace.uuid)) {
    Dialog.alert(t('settings.experts.exportSuccess'))
  } else {
    Dialog.alert(t('settings.experts.exportError'))
  }
}

const onNew = () => {
  emit('create')
}

const onCopy = () => {

  if (selectedExperts.value.length !== 1) { console.log('Copy expert: invalid selection'); return }
  const expert = experts.value.find(e => e.id === selectedExperts.value[0])
  if (!expert) { console.log('Copy expert: expert not found'); return }

  const copy = newExpert()
  copy.id = uuidv4()
  copy.name = (expert.name || expertI18n(expert, 'name')) + ' (' + t('settings.experts.copy') + ')'
  copy.prompt = expert.prompt || expertI18n(expert, 'prompt')
  copy.description = expert.description || expertI18n(expert, 'description')
  copy.categoryId = expert.categoryId
  copy.triggerApps = expert.triggerApps

  const index = experts.value.indexOf(expert)
  experts.value.splice(index + 1, 0, copy)
  selectedExperts.value = [copy.id]

  save()

}

const onEdit = (expert: Expert) => {
  emit('edit', expert)
}

const onDelete = () => {
  if (selectedExperts.value.length === 0) return

  Dialog.show({
    target: document.querySelector('.settings .experts'),
    title: t('settings.experts.confirmDelete', { count: selectedExperts.value.length }),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      const selectedIds = new Set(selectedExperts.value)

      // Mark system experts as deleted
      experts.value.forEach((expert: Expert) => {
        if (selectedIds.has(expert.id) && expert.type === 'system') {
          expert.state = 'deleted'
        }
      })

      // Remove user experts
      experts.value = experts.value.filter((expert: Expert) =>
        expert.type === 'system' || !selectedIds.has(expert.id)
      )

      selectedExperts.value = []
      save()
    }
  })
}

const onDeleteSingle = (expert: Expert) => {
  Dialog.show({
    target: document.querySelector('.settings .experts'),
    title: t('settings.experts.confirmDelete', { count: 1 }),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      if (expert.type == 'system') {
        expert.state = 'deleted'
      } else {
        const index = experts.value.indexOf(expert)
        experts.value.splice(index, 1)
      }
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
      selectedExperts.value = []
      save()
    }
  })
}

const onEnabled = (expert: Expert) => {
  expert.state = (expert.state == 'enabled' ? 'disabled' : 'enabled')
  save()
}

const load = () => {
  experts.value = window.api.experts.load(props.workspace.uuid)
  categories.value = window.api.experts.loadCategories(props.workspace.uuid)
}

const save = () => {
  window.api.experts.save(props.workspace.uuid, JSON.parse(JSON.stringify(experts.value)))
  window.api.experts.saveCategories(props.workspace.uuid, JSON.parse(JSON.stringify(categories.value)))
  emit('save')
}

const onCategoriesUpdate = () => {
  load()
}

const closeCategoryManager = () => {
  showCategoryManager.value = false
}

defineExpose({ load })

</script>


<style scoped>

/* Component-specific styles - common styles in css/list-with-toolbar.css */

.list-filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  overflow: visible;
}

.search-input {
  flex: 1;
}

.category-filter {
  min-width: 150px;
}

</style>
