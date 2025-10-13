<template>

  <section>
    
    <header>
      <h1>{{ t('onboarding.permissions.title') }}</h1>
      <h3>{{ t('onboarding.permissions.subtitle') }}</h3>
    </header>

    <main class="permissions">
      
      <!-- Permissions status display -->
      <div class="form permissions-grid form-large">
        
        <!-- Accessibility Permission -->
        <div class="permission-card" :class="{ 'granted': accessibilityGranted, 'denied': !accessibilityGranted }">
          <div class="permission-icon">
            <CircleUserIcon />
          </div>
          <div class="permission-info">
            <h3>{{ t('onboarding.permissions.accessibility.title') }}</h3>
            <p>{{ t('onboarding.permissions.accessibility.description') }}</p>
            <div class="permission-status">
              <CheckCircleIcon v-if="accessibilityGranted" class="status-icon granted" />
              <XCircleIcon v-else class="status-icon denied" />
              <span>{{ accessibilityGranted ? t('onboarding.permissions.granted') : t('onboarding.permissions.denied') }}</span>
            </div>
          </div>
          <button v-if="!accessibilityGranted" @click="openAccessibilitySettings">
            {{ t('onboarding.permissions.openSettings') }}
          </button>
        </div>

        <!-- Automation Permission -->
        <div class="permission-card" :class="{ 'granted': automationGranted, 'denied': !automationGranted }">
          <div class="permission-icon">
            <SettingsIcon />
          </div>
          <div class="permission-info">
            <h3>{{ t('onboarding.permissions.automation.title') }}</h3>
            <p>{{ t('onboarding.permissions.automation.description') }}</p>
            <div class="permission-status">
              <CheckCircleIcon v-if="automationGranted" class="status-icon granted" />
              <XCircleIcon v-else class="status-icon denied" />
              <span>{{ automationGranted ? t('onboarding.permissions.granted') : t('onboarding.permissions.denied') }}</span>
            </div>
          </div>
          <button v-if="!automationGranted" @click="openAutomationSettings">
            {{ t('onboarding.permissions.openSettings') }}
          </button>
        </div>
        
      </div>

      <div class="permissions-info">
        <InfoIcon class="info-icon"/>
        <div class="info-text">{{ t('onboarding.permissions.info') }}</div>
      </div>

    </main>

  </section>

</template>

<script setup lang="ts">

import { CheckCircleIcon, CircleUserIcon, InfoIcon, SettingsIcon, XCircleIcon } from 'lucide-vue-next'
import { computed, onUnmounted, ref } from 'vue'
import Dialog from '../composables/dialog'
import { t } from '../services/i18n'

// Permission states
const accessibilityGranted = ref(false)
const automationGranted = ref(false)

// Polling interval reference
let pollInterval: NodeJS.Timeout | null = null

// Computed property to check if all permissions are granted
const allPermissionsGranted = computed(() => {
  return accessibilityGranted.value && automationGranted.value
})

// Method to check permissions status
const checkPermissions = async () => {
  if (window.api.platform === 'darwin') {
    try {
      // Check accessibility permission
      accessibilityGranted.value = await window.api.permissions.checkAccessibility()
      
      // Check automation permission  
      automationGranted.value = await window.api.permissions.checkAutomation()
    } catch (error) {
      console.error('Error checking permissions:', error)
      // Default to false on error
      accessibilityGranted.value = false
      automationGranted.value = false
    }
  } else {
    // On non-macOS platforms, consider permissions granted
    accessibilityGranted.value = true
    automationGranted.value = true
  }
}

// Method to open accessibility settings
const openAccessibilitySettings = async () => {
  try {
    await window.api.permissions.openAccessibilitySettings()
  } catch (error) {
    console.error('Error opening accessibility settings:', error)
  }
}

// Method to open automation settings
const openAutomationSettings = async () => {
  try {
    await window.api.permissions.openAutomationSettings()
  } catch (error) {
    console.error('Error opening automation settings:', error)
  }
}

// Can leave method for onboarding flow
const canLeave = async (): Promise<boolean> => {
  // If all permissions are granted, allow leaving without prompt
  if (allPermissionsGranted.value) {
    return true
  }

  // Show confirmation dialog if permissions are not fully granted
  const rc = await Dialog.show({
    title: t('onboarding.permissions.leave.title'),
    text: t('onboarding.permissions.leave.message'),
    showCancelButton: true,
    confirmButtonText: t('common.yes'),
    cancelButtonText: t('common.no'),
  })

  return rc.isConfirmed
}

// Clean up polling on unmount
onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
})

// Expose methods for parent component
defineExpose({
  canLeave,
  allPermissionsGranted,
  onVisible: async () => {
    if (!pollInterval) {
      await new Promise(resolve => setTimeout(resolve, 500))
      checkPermissions()
      pollInterval = setInterval(checkPermissions, 1000)
    }
  }
})

</script>

<style scoped>

.permissions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  max-width: 600px;
  margin-top: 1rem;
}

.permissions-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.permission-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background-color: var(--background-color);
  transition: all 0.3s ease;
}

.permission-card.granted {
  border-color: var(--success-color);
  background-color: rgba(34, 197, 94, 0.12);
}

.permission-card.denied {
  border-color: var(--error-color);
  background-color: rgba(245, 158, 11, 0.12);
}

.permission-icon {
  font-size: 3rem;
  color: var(--dimmed-text-color);
}

.permission-card.granted .permission-icon {
  color: #10b981;
}

.permission-card.denied .permission-icon {
  color: #f59e0b;
}

.permission-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: auto;
}

.status-icon {
  font-size: 1.2rem;
}

.status-icon.granted {
  color: #10b981;
}

.status-icon.denied {
  color: #f59e0b;
}

.permissions-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0rem 1.5rem;
  background-color: var(--background-alt-color);
  border-radius: 12px;
}

.info-icon {
  font-size: 1.5rem;
  color: var(--accent-color);
  flex-shrink: 0;
}

.info-text {
  flex: 1;
}

.info-text p {
  margin: 0 0 0.5rem 0;
  color: var(--dimmed-text-color);
  font-size: 0.9rem;
  line-height: 1.4;
}

.info-text p:last-child {
  margin-bottom: 0;
}

.refresh-note {
  font-weight: 500;
  color: var(--text-color);
}

@media (min-width: 640px) {
  .permissions-grid {
    grid-template-columns: 1fr 1fr;
  }
  
  .permission-card {
    text-align: center;
  }
}

</style>
