<template>
  <div class="category-manager panel">
    <div class="panel-header">
      <h3>{{ t('settings.experts.categoryManager.title') }}</h3>
      <button class="close-button" @click="onClose">
        <XIcon />
      </button>
    </div>
    <div class="panel-content">
      <div v-if="categories.length === 0" class="empty-state">
        {{ t('settings.experts.categoryManager.empty') }}
      </div>
      <table v-else class="category-list">
        <tbody>
          <tr v-for="category in categories" :key="category.id" class="category-row">
            <td class="category-name">
              <input
                v-if="editingId === category.id"
                v-model="editingName"
                type="text"
                @keydown.enter="saveEdit(category.id)"
                @keydown.escape="cancelEdit"
                @blur="saveEdit(category.id)"
                ref="editInput"
                class="edit-input"
              />
              <span v-else>{{ category.name }}</span>
              <span class="category-count">({{ getExpertCount(category.id) }})</span>
            </td>
            <td class="category-actions">
              <button
                @click="startEdit(category)"
                class="action-button"
                :title="t('common.edit')"
                :disabled="category.type === 'system'"
              >
                <PencilIcon />
              </button>
              <button
                @click="onDelete(category)"
                class="action-button delete"
                :title="t('common.delete')"
                :disabled="category.type === 'system'"
              >
                <Trash2Icon />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="new-category-section">
        <button @click="onNewCategory" class="button default">
          <PlusIcon />{{ t('settings.experts.categoryManager.newCategory') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-vue-next'
import { computed, nextTick, ref } from 'vue'
import Dialog from '../composables/dialog'
import { createCategory, deleteCategory, updateCategory } from '../services/categories'
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
  background: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: var(--text-color);
  display: flex;
  align-items: center;
}

.close-button:hover {
  color: var(--highlight-color);
}

.close-button svg {
  width: 1.25rem;
  height: 1.25rem;
}

.panel-content {
  padding: 1rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary-color);
  font-style: italic;
}

.category-list {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

.category-row {
  border-bottom: 1px solid var(--border-color);
}

.category-row:last-child {
  border-bottom: none;
}

.category-name {
  padding: 0.75rem 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.category-name span {
  flex: 1;
}

.category-count {
  color: var(--text-secondary-color);
  font-size: 0.9em;
}

.edit-input {
  flex: 1;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--highlight-color);
  border-radius: 0.25rem;
  background: var(--background-color);
  color: var(--text-color);
  font-size: 1rem;
}

.edit-input:focus {
  outline: none;
  border-color: var(--highlight-color);
}

.category-actions {
  padding: 0.75rem 0.5rem;
  text-align: right;
  white-space: nowrap;
}

.action-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: var(--text-color);
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem;
}

.action-button:hover:not(:disabled) {
  color: var(--highlight-color);
}

.action-button.delete:hover:not(:disabled) {
  color: var(--color-error);
}

.action-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-button svg {
  width: 1rem;
  height: 1rem;
}

.new-category-section {
  display: flex;
  justify-content: center;
  padding-top: 0.5rem;
}

.new-category-section .button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.new-category-section .button svg {
  width: 1rem;
  height: 1rem;
}
</style>
