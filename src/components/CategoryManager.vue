<template>
  <div class="panel category-manager">
    <header class="panel-header">
      <label>{{ t('settings.experts.categoryManager.title') }}</label>
      <XIcon class="icon" @click="onClose" />
    </header>
    <main class="panel-body" :class="{ empty: categoriesSorted.length === 0 }">
      <div v-if="categoriesSorted.length === 0" class="panel-empty">
        {{ t('settings.experts.categoryManager.empty') }}
      </div>
      <table v-else class="table-plain">
        <tbody>
          <tr v-for="category in categoriesSorted" :key="category.id">
            <td @click="startEdit(category)">
              <input
                v-if="editingCategory?.id === category.id"
                v-model="editingName"
                type="text"
                @keydown.enter="saveEdit"
                @keydown.escape="cancelEdit"
                @blur="saveEdit"
                @click.stop
                ref="editInput"
                class="edit-input"
              />
              <template v-else>
                {{ category.name || categoryI18n(category, 'name') }}
              </template>
            </td>
            <td>
              <div class="actions">
                <ButtonIcon @click="startEdit(category)"><PencilIcon /></ButtonIcon>
                <ButtonIcon v-if="category.type === 'system'" @click="toggleVisibility(category)" :title="t('settings.experts.categoryManager.toggleVisibility')">
                  <Eye v-if="category.state === 'enabled'" />
                  <EyeOff v-else />
                </ButtonIcon>
                <ButtonIcon v-else @click="onDelete(category)"><Trash2Icon class="error" /></ButtonIcon>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </main>
    <footer class="panel-footer">
      <button @click="onNewCategory">
        <PlusIcon />{{ t('settings.experts.categoryManager.newCategory') }}
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { Eye, EyeOff, PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-vue-next'
import { saveCategories } from '../services/experts'
import { computed, nextTick, ref } from 'vue'
import Dialog from '../composables/dialog'
import { createCategory, deleteCategory } from '../services/categories'
import { t, categoryI18n, categoryI18nDefault } from '../services/i18n'
import { store } from '../services/store'
import { Expert, ExpertCategory } from '../types/index'
import ButtonIcon from './ButtonIcon.vue'

const emit = defineEmits<{
  update: []
  close: []
}>()

const editingCategory = ref<ExpertCategory | null>(null)
const editingName = ref('')
const editInput = ref<HTMLInputElement[]>([])

const categoriesSorted = computed(() => {
  return [...store.expertCategories].sort((a, b) => {
    return categoryI18n(a, 'name').localeCompare(categoryI18n(b, 'name'))
  })
})

const getExpertCount = (categoryId: string): number => {
  return store.experts.filter((e: Expert) => e.categoryId === categoryId && e.state !== 'deleted').length
}

const startEdit = async (category: ExpertCategory) => {
  editingCategory.value = category
  editingName.value = categoryI18n(category, 'name')
  await nextTick()
  if (editInput.value && editInput.value[0]) {
    editInput.value[0].focus()
    editInput.value[0].select()
  }
}

const saveEdit = () => {
  if (!editingName.value || !editingName.value.trim() || !editingCategory.value) {
    cancelEdit()
    return
  }

  // Check for duplicate names
  const duplicate = store.expertCategories.find(
    c => c.id !== editingCategory.value!.id && c.name?.toLowerCase() === editingName.value.trim().toLowerCase()
  )
  if (duplicate) {
    Dialog.alert(t('settings.experts.categoryManager.duplicateName'))
    return
  }

  // If the name matches the default i18n value, clear it to use the i18n key instead
  // This allows system categories to fall back to their localized names
  let newName = editingName.value.trim()
  if (newName.trim() === categoryI18nDefault(editingCategory.value, 'name')) {
    newName = undefined
  }

  // Update the category name directly
  editingCategory.value.name = newName
  saveCategories(store.config.workspaceId)
  emit('update')
  cancelEdit()
}

const cancelEdit = () => {
  editingCategory.value = null
  editingName.value = ''
}

const onNewCategory = async () => {
  const result = await Dialog.show({
    title: t('settings.experts.categoryManager.newCategory'),
    input: 'text',
    inputPlaceholder: t('settings.experts.categoryManager.categoryName'),
    showCancelButton: true,
    confirmButtonText: t('common.create'),
  })

  if (result.isDismissed || !result.value?.trim()) {
    return
  }

  // Check for duplicate names
  const duplicate = store.expertCategories.find(
    c => c.name?.toLowerCase() === result.value.trim().toLowerCase()
  )
  if (duplicate) {
    Dialog.alert(t('settings.experts.categoryManager.duplicateName'))
    return
  }

  const newCategory = createCategory(result.value.trim())
  store.expertCategories.push(newCategory)
  saveCategories(store.config.workspaceId)
  emit('update')
}

const toggleVisibility = (category: ExpertCategory) => {
  // Toggle between enabled and disabled (no confirmation needed)
  category.state = category.state === 'enabled' ? 'disabled' : 'enabled'
  saveCategories(store.config.workspaceId)
  emit('update')
}

const onDelete = async (category: ExpertCategory) => {
  // Only user categories can be deleted
  if (category.type === 'system') return

  const expertCount = getExpertCount(category.id)

  if (expertCount === 0) {
    
    // No experts, simple confirmation
    const result = await Dialog.show({
      title: t('settings.experts.categoryManager.confirmDelete'),
      text: t('common.confirmation.cannotUndo'),
      confirmButtonText: t('common.delete'),
      showCancelButton: true,
    })

    if (result.isConfirmed) {
      store.expertCategories = store.expertCategories.filter(c => c.id !== category.id)
      saveCategories(store.config.workspaceId)
      emit('update')
    }
  
  } else {
    // Has experts, ask what to do
    const result = await Dialog.show({
      title: t('settings.experts.categoryManager.confirmDelete'),
      text: t('settings.experts.categoryManager.deleteText'),
      confirmButtonText: t('settings.experts.categoryManager.keepExperts'),
      denyButtonText: t('settings.experts.categoryManager.deleteExperts'),
      showCancelButton: true,
      showDenyButton: true,
      customClass: { 'actions': 'actions-stacked' }
    })

    if (result.isDismissed) {
      return
    }

    const deleteExperts = result.isDenied
    deleteCategory(category.id, deleteExperts)
    saveCategories(store.config.workspaceId)
    emit('update')
  }
}

const onClose = () => {
  emit('close')
}
</script>

<style scoped>
.category-manager {
  margin-bottom: 1rem;
  padding: 0.5rem;

  .panel-header {
    padding-bottom: 0;
  }
  .panel-body {
    padding: 0rem 1rem;
    table.table-plain {
      td {
        padding: 0.25rem 0.75rem;
        .actions {
          margin: 0;
        }
      }
    }

  }
  .panel-footer {
    padding: 1rem;
  }
}

.edit-input {
  width: 100%;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--highlight-color);
  border-radius: 0.25rem;
  font-size: 14px;
}

td:first-child {
  width: 100%;
  cursor: pointer;
}
</style>
