<template>
  <div class="form form-vertical form-large">
      <div class="description">
        {{ t('settings.plugins.skills.description') }}
      </div>
      <div class="form-field horizontal">
        <input type="checkbox" id="skills-enabled" name="enabled" v-model="enabled" @change="onEnabledChanged" />
        <label for="skills-enabled">{{ t('common.enabled') }}</label>
      </div>

      <template v-if="enabled">
      <div v-if="showLocationManager" class="list-with-toolbar">
        <div class="toolbar">
          <div class="functional-controls">
            <div class="actions">
              <button type="button" class="secondary" name="add-location" @click="addLocation"><FolderPlusIcon />{{ t('settings.plugins.skills.addLocation') }}</button>
              <div class="flex-push"></div>
              <button type="button" class="primary" name="close-location-manager" @click="closeLocationManager">{{ t('common.close') }}</button>
            </div>
          </div>
        </div>

        <table class="table-plain">
          <thead>
            <tr>
              <th>{{ t('common.name') }}</th>
              <th>{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in locationRows" :key="row.id">
              <td class="name">
                <div>
                  {{ row.path }}
                </div>
              </td>
              <td>
                <ButtonIcon @click="removeSingleLocation(row.path)" v-if="!row.locked">
                  <Trash2Icon />
                </ButtonIcon>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="list-with-toolbar">
        <div class="toolbar">
          <div class="functional-controls">
            <div class="item-count">
              <span>{{ t('settings.plugins.skills.skillsCount', { count: skills.length }) }}</span>
            </div>
            <div class="actions">
              <button type="button" class="secondary" name="new" @click="emit('create')"><PlusIcon />{{ t('common.new') }}</button>
              <button type="button" class="primary" name="install" @click="installFromUrl" :disabled="installing">
                <SpinningIcon v-if="installing" :spinning="true" />
                <PlusIcon v-else />
                {{ installing ? t('settings.plugins.skills.installing') : t('settings.plugins.skills.installButton') }}
              </button>
            </div>
          </div>

          <div class="actions">
            <ContextMenuTrigger class="toolbar-menu" position="below-right" :bordered="true">
              <template #menu>
                <div class="item" @click="openLocationManager">{{ t('settings.plugins.skills.manageLocations') }}</div>
                <div class="item" @click="refreshSkills">{{ t('settings.plugins.skills.refresh') }}</div>
              </template>
            </ContextMenuTrigger>
          </div>
        </div>

        <table class="table-plain" v-if="skills.length > 0">
          <thead>
            <tr>
              <th class="skill-name">{{ t('common.name') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="skill in skills" :key="skill.id">
              <td class="skill-name"><div>
                <ZapIcon />
                {{ skill.name }}
              </div></td>
              <td class="skill-actions">
                <ButtonIcon @click="editSkill(skill)" v-if="canEditSkill(skill)">
                  <PencilIcon />
                </ButtonIcon>
                <ButtonIcon @click="viewSkill(skill)" v-else>
                  <EyeIcon />
                </ButtonIcon>
                <ButtonIcon @click="uninstallSkill(skill)">
                  <Trash2Icon />
                </ButtonIcon>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="empty-state" v-else>
          <p>{{ t('settings.plugins.skills.empty') }}</p>
          <button type="button" class="primary" @click="installFromUrl" :disabled="installing">
            <SpinningIcon v-if="installing" :spinning="true" />
            <PlusIcon v-else />
            {{ installing ? t('settings.plugins.skills.installing') : t('settings.plugins.skills.installButton') }}
          </button>
        </div>
      </div>
      </template>
  </div>
</template>

<script setup lang="ts">

import ButtonIcon from '@components/ButtonIcon.vue'
import ContextMenuTrigger from '@components/ContextMenuTrigger.vue'
import SpinningIcon from '@components/SpinningIcon.vue'
import Dialog from '@renderer/utils/dialog'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { EyeIcon, FolderPlusIcon, PencilIcon, PlusIcon, Trash2Icon, ZapIcon } from 'lucide-vue-next'
import { Skill, SkillHeader } from 'types/skills'
import { computed, ref } from 'vue'

type LocationScope = 'claude' | 'global' | 'workspace' | 'custom'
type LocationRow = {
  id: string
  path: string
  scope: LocationScope
  locked: boolean
}
type SkillDraft = {
  id?: string
  name?: string
  description?: string
  instructions?: string
  rootPath?: string
  readonly?: boolean
}

const enabled = ref(false)
const skills = ref<SkillHeader[]>([])
const showLocationManager = ref(false)
const defaultLocations = ref<string[]>([])
const locations = ref<string[]>([])
const installing = ref(false)
const emit = defineEmits<{
  'create': []
  'edit': [SkillDraft]
}>()

const inferScope = (location: string): Exclude<LocationScope, 'custom'> => {
  if (/[\\/]\\.claude[\\/]skills$/i.test(location)) return 'claude'
  if (/[\\/]workspaces[\\/][^\\/]+[\\/]skills$/i.test(location)) return 'workspace'
  return 'global'
}

const locationRows = computed<LocationRow[]>(() => {
  const defaults: LocationRow[] = defaultLocations.value.map((location, index) => ({
    id: `default-${index}`,
    path: location,
    scope: inferScope(location),
    locked: true,
  }))
  const customs: LocationRow[] = locations.value.map(location => ({
    id: `custom-${location}`,
    path: location,
    scope: 'custom',
    locked: false,
  }))
  return [...defaults, ...customs]
})

const refreshSkills = () => {
  skills.value = window.api.skills.list(store.config.workspaceId)
}

const load = () => {
  enabled.value = store.config.plugins.skills?.enabled || false
  locations.value = store.config.skills.locations || []
  defaultLocations.value = window.api.skills.defaultLocations(store.config.workspaceId)
  refreshSkills()
}

const save = () => {
  store.config.plugins.skills.enabled = enabled.value
  store.config.skills.locations = locations.value
    .map(location => location.trim())
    .filter(location => location.length > 0)
  store.saveSettings()
}

const onEnabledChanged = () => {
  save()
  refreshSkills()
}

const openLocationManager = () => {
  showLocationManager.value = true
}

const closeLocationManager = () => {
  showLocationManager.value = false
}

const addLocation = async () => {
  const location = await window.api.file.pickDirectory()
  if (!location) return

  if (!locations.value.includes(location)) {
    locations.value.push(location)
    save()
    refreshSkills()
  }
}

const isEcosystemLocation = (location: string): boolean => {
  const normalized = location.replace(/[\\/]+$/, '')
  return /[\\/]\.agents[\\/]skills$/i.test(normalized)
}

const removeSingleLocation = async (location: string) => {
  const text = isEcosystemLocation(location)
    ? t('settings.plugins.skills.removeEcosystemWarning')
    : t('common.confirmation.cannotUndo')

  const result = await Dialog.show({
    target: document.querySelector('.main'),
    title: t('common.confirmation.delete'),
    text,
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  })

  if (!result.isConfirmed) return
  locations.value = locations.value.filter(l => l !== location)
  save()
  refreshSkills()
}

const resolveGlobalSkillLocation = (): string => {
  if (defaultLocations.value.length >= 1) {
    return defaultLocations.value[0]
  }
  return ''
}

const canEditSkill = (skill: SkillHeader): boolean => isSystemSkillLocation(skill)

const isSystemSkillLocation = (skill: SkillHeader): boolean => {
  const normalizedRoot = skill.rootPath.replace(/[\\/]+$/, '')
  return defaultLocations.value.some((location) => {
    const normalizedSystem = location.replace(/[\\/]+$/, '')
    const prefix = `${normalizedSystem}${window.api.platform === 'win32' ? '\\' : '/'}`
    return normalizedRoot.startsWith(prefix)
  })
}

const installFromUrl = async () => {
  if (installing.value) return

  const rc = await Dialog.show({
    target: document.querySelector('.main'),
    title: t('settings.plugins.skills.installDialogTitle'),
    text: t('settings.plugins.skills.installNote'),
    input: 'text',
    inputPlaceholder: 'https://github.com/owner/repo or npx skills add <url> --skill <name>',
    showCancelButton: true,
    confirmButtonText: t('settings.plugins.skills.installButton'),
    inputValidator: (value) => {
      if (!value?.trim()) {
        return t('settings.plugins.skills.installInvalidUrl')
      }
      return null
    },
  })

  if (!rc.isConfirmed || !(rc as any).value) return

  const url = (rc as any).value.trim()
  const installPath = resolveGlobalSkillLocation()
  if (!installPath.length) {
    await Dialog.show({
      target: document.querySelector('.main'),
      title: t('common.error'),
      text: t('settings.plugins.skills.installPathUnavailable'),
    })
    return
  }

  installing.value = true
  try {
    const result = await window.api.skills.installFromUrl(url, installPath)
    if (!result.success) {
      await Dialog.show({
        target: document.querySelector('.main'),
        title: t('common.error'),
        text: result.error || t('settings.plugins.skills.installFailed'),
      })
      return
    }

    await Dialog.show({
      target: document.querySelector('.main'),
      title: t('common.ok'),
      text: t('settings.plugins.skills.installSuccess', { count: result.installed.length }),
    })
    refreshSkills()
  } finally {
    installing.value = false
  }
}

const uninstallSkill = async (skill: SkillHeader) => {
  const isSystemSkill = isSystemSkillLocation(skill)
  const rc = await Dialog.show({
    target: document.querySelector('.main'),
    title: t('settings.plugins.skills.confirmUninstallTitle', { skill: skill.name }),
    text: isSystemSkill
      ? t('common.confirmation.cannotUndo')
      : t('settings.plugins.skills.confirmUninstallSharedText', { skill: skill.name }),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  })

  if (!rc.isConfirmed) return

  const result = window.api.skills.uninstall(store.config.workspaceId, skill.id)
  if (!result.success) {
    await Dialog.show({
      target: document.querySelector('.main'),
      title: t('common.error'),
      text: result.error || t('settings.plugins.skills.uninstallFailed'),
    })
    return
  }

  refreshSkills()
}

const editSkill = async (skill: SkillHeader) => {
  const loaded = window.api.skills.load(store.config.workspaceId, skill.id)
  emit('edit', {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    instructions: loaded?.instructions || '',
    rootPath: skill.rootPath,
    readonly: false,
  })
}

const viewSkill = async (skill: SkillHeader) => {
  const loaded = window.api.skills.load(store.config.workspaceId, skill.id)
  emit('edit', {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    instructions: loaded?.instructions || '',
    rootPath: skill.rootPath,
    readonly: true,
  })
}

defineExpose({ load })

</script>

<style scoped>

.name div {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-with-toolbar {

  .functional-controls {
    .actions {
      flex: 1;
    }
  }

  .skill-name > div {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .skill-actions {
    display: flex;
    gap: var(--space-4);
    svg {
      width: var(--icon-lg);
      height: var(--icon-lg);
      cursor: pointer;
    }
  }
}

</style>
