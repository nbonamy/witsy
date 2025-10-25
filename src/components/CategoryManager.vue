<template>
  <div class="panel category-manager">
    <header class="panel-header">
      <label>{{ t('settings.experts.categoryManager.title') }}</label>
      <XIcon class="icon" @click="onClose" />
    </header>
    <main class="panel-body" :class="{ empty: categories.length === 0 }">
      <div v-if="categories.length === 0" class="panel-empty">
        {{ t('settings.experts.categoryManager.empty') }}
      </div>
      <table v-else class="table-plain">
        <tbody>
          <tr v-for="category in categories" :key="category.id">
            <td>
              <input
                v-if="editingId === category.id"
                v-model="editingName"
                type="text"
                @keydown.enter="saveEdit(category.id)"
                @keydown.escape="cancelEdit"
                @blur="saveEdit(category.id)"
                @click.stop
                ref="editInput"
                class="edit-input"
              />
              <span v-else @click="startEdit(category)">
                {{ category.name || getCategoryLabel(category.id, categories) }}
                <span class="count">({{ getExpertCount(category.id) }})</span>
              </span>
            </td>
            <td>
              <div class="actions">
                <PencilIcon
                  @click="startEdit(category)"
                  :class="{ disabled: category.type === 'system' }"
                />
                <Trash2Icon
                  class="error"
                  @click="onDelete(category)"
                  :class="{ disabled: category.type === 'system' }"
                />
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
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-vue-next'
import { computed, nextTick, ref } from 'vue'
import Dialog from '../composables/dialog'
import { createCategory, deleteCategory, getCategoryLabel, updateCategory } from '../services/categories'
import { t } from '../services/i18n'
import { Expert, ExpertCategory } from '../types/index'

const props = defineProps<{
  categories: ExpertCategory[]
  experts: Expert[]
}>()

const emit = defineEmits<{
  update: [categories: ExpertCategory[], experts: Expert[]]
  close: []
}>()

const editingId = ref<string | null>(null)
const editingName = ref('')
const editInput = ref<HTMLInputElement[]>([])

const getExpertCount = (categoryId: string): number => {
  return props.experts.filter(e => e.categoryId === categoryId && e.state !== 'deleted').length
}

const startEdit = async (category: ExpertCategory) => {
  // Don't allow editing system categories
  if (category.type === 'system') {
    return
  }
  editingId.value = category.id
  editingName.value = category.name || ''
  await nextTick()
  if (editInput.value && editInput.value[0]) {
    editInput.value[0].focus()
    editInput.value[0].select()
  }
}

const saveEdit = (categoryId: string) => {
  if (!editingName.value.trim()) {
    cancelEdit()
    return
  }

  // Check for duplicate names
  const duplicate = props.categories.find(
    c => c.id !== categoryId && c.name?.toLowerCase() === editingName.value.trim().toLowerCase()
  )
  if (duplicate) {
    Dialog.alert(t('settings.experts.categoryManager.duplicateName'))
    return
  }

  const updatedCategories = updateCategory(categoryId, editingName.value.trim(), [...props.categories])
  emit('update', updatedCategories, props.experts)
  cancelEdit()
}

const cancelEdit = () => {
  editingId.value = null
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
  const duplicate = props.categories.find(
    c => c.name?.toLowerCase() === result.value.trim().toLowerCase()
  )
  if (duplicate) {
    Dialog.alert(t('settings.experts.categoryManager.duplicateName'))
    return
  }

  const newCategory = createCategory(result.value.trim())
  const updatedCategories = [...props.categories, newCategory]
  emit('update', updatedCategories, props.experts)
}

const onDelete = async (category: ExpertCategory) => {
  // Don't allow deleting system categories
  if (category.type === 'system') {
    return
  }

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
      const updatedCategories = props.categories.filter(c => c.id !== category.id)
      emit('update', updatedCategories, props.experts)
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
    const { categories: updatedCategories, experts: updatedExperts } = deleteCategory(
      category.id,
      deleteExperts,
      props.categories,
      props.experts
    )
    emit('update', updatedCategories, updatedExperts)
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
    padding: 0rem;
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
