<template>
  <div class="category-manager list-with-toolbar">
    <div class="toolbar" v-if="categoriesSorted.length > 0">
      <button name="new" class="primary" @click="onNewCategory">
        <PlusIcon />
        {{ t('settings.experts.categoryManager.newCategory') }}
      </button>
      <div class="actions">
        <button name="close" @click="onClose">{{ t('common.done') }}</button>
      </div>
    </div>
    <table class="table-plain" v-if="categoriesSorted.length > 0">
      <thead>
        <tr>
          <th>{{ t('common.name') }}</th>
          <th>{{ t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="category in categoriesSorted" :key="category.id" class="category">
          <td class="name" @click="startEdit(category)">
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
    <div class="empty-state" v-if="categoriesSorted.length === 0">
      <p>{{ t('settings.experts.categoryManager.empty') }}</p>
      <button type="button" class="primary" @click="onNewCategory">
        <PlusIcon />
        {{ t('settings.experts.categoryManager.newCategory') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Eye, EyeOff, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, toRaw } from 'vue'
import Dialog from '@renderer/utils/dialog'
import { createCategory, deleteCategory } from '@services/categories'
import { categoryI18n, categoryI18nDefault, t } from '@services/i18n'
import { Expert, ExpertCategory } from 'types/index'
import { Workspace } from 'types/workspace'
import ButtonIcon from './ButtonIcon.vue'

const props = defineProps<{
  workspace: Workspace
}>()

const emit = defineEmits<{
  update: []
  close: []
}>()

const experts = ref<Expert[]>([])
const categories = ref<ExpertCategory[]>([])
const editingCategory = ref<ExpertCategory | null>(null)
const editingName = ref('')
const editInput = ref<HTMLInputElement[]>([])

onMounted(() => {
  load()
})

const load = () => {
  experts.value = window.api.experts.load(props.workspace.uuid)
  categories.value = window.api.experts.loadCategories(props.workspace.uuid)
}

const categoriesSorted = computed(() => {
  return [...categories.value.sort((a, b) => {
    return categoryI18n(a, 'name').localeCompare(categoryI18n(b, 'name'))
  })]
})

const getExpertCount = (categoryId: string): number => {
  return experts.value.filter((e: Expert) => e.categoryId === categoryId && e.state !== 'deleted').length
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
  const duplicate = categories.value.find(
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
  save()
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
  const duplicate = categories.value.find(
    c => c.name?.toLowerCase() === result.value.trim().toLowerCase()
  )
  if (duplicate) {
    Dialog.alert(t('settings.experts.categoryManager.duplicateName'))
    return
  }

  const newCategory = createCategory(result.value.trim())
  categories.value.push(newCategory)
  save()
  emit('update')
}

const toggleVisibility = (category: ExpertCategory) => {
  // Toggle between enabled and disabled (no confirmation needed)
  category.state = category.state === 'enabled' ? 'disabled' : 'enabled'
  save()
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
      categories.value = categories.value.filter(c => c.id !== category.id)
      save()
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
    const update = deleteCategory(experts.value, categories.value, category.id, deleteExperts)
    experts.value = update.experts
    categories.value = update.categories
    save()
    emit('update')
  }
}

const save = () => {
  window.api.experts.save(props.workspace.uuid, toRaw(experts.value))
  window.api.experts.saveCategories(props.workspace.uuid, toRaw(categories.value))
}

const onClose = () => {
  emit('close')
}

</script>

<style scoped>
.category-manager {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  padding: 40px 20px;
  color: var(--dimmed-text-color);
}

.empty-state button.primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 12px;
  font-weight: 600;
}

.edit-input {
  width: 100%;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--highlight-color);
  border-radius: 0.25rem;
  font-size: 14px;
}
</style>
