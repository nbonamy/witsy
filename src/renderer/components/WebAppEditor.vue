<template>
  <div class="webapp-editor form form-vertical form-large" @keydown.enter="onSave">
    <div class="form-field">
      <label>{{ t('webapps.name') }}</label>
      <input type="text" name="name" v-model="name" required />
    </div>
    <div class="form-field">
      <label>{{ t('webapps.url') }}</label>
      <input type="url" name="url" v-model="url" required placeholder="https://example.com" @input="updateFaviconUrl"/>
    </div>
    <div class="form-field">
      <label>{{ t('webapps.icon') }}</label>
      <div class="icon-selection">
        <div class="icon-option" :class="{ active: !icon }" @click="useWebsiteIcon">
          <div class="icon-preview">
            <img v-if="faviconUrl" :src="faviconUrl" class="favicon" :class="{ 'grayscale': !preserveColors }" alt="Website icon"/>
            <GlobeIcon v-else class="placeholder-icon" />
          </div>
          <div class="form-field horizontal">
            <input type="checkbox" id="use-website-icon" v-model="preserveColors" />
            <label for="use-website-icon">{{ t('webapps.preserveColors') }}</label>
          </div>
        </div>
        <div class="icon-option" :class="{ active: !!icon }">
          <IconPicker v-model="icon" />
        </div>
      </div>
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="webapp-enabled" v-model="enabled" />
      <label for="webapp-enabled">{{ t('webapps.enabled') }}</label>
    </div>
    <div class="buttons">
      <button type="button" @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      <button type="button" @click="onSave" class="default">{{ t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { GlobeIcon } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'
import IconPicker from '../components/IconPicker.vue'
import Dialog from '../utils/dialog'
import { t } from '../services/i18n'
import { WebApp } from 'types/workspace'

const emit = defineEmits(['webapp-modified'])

const props = defineProps<{
  webapp: WebApp | null
}>()

const name = ref('')
const url = ref('')
const faviconUrl = ref('')
const icon = ref<string | undefined>(undefined)
const preserveColors = ref(false)
const enabled = ref(true)

const updateFaviconUrl = async () => {

  // reset it
  faviconUrl.value = ''
  if (!url.value) return

  // Basic regex validation for HTTP/HTTPS URLs
  const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/
  if (!urlRegex.test(url.value)) {
    return ''
  }

  try {
    const googleUrl = `https://s2.googleusercontent.com/s2/favicons?sz=48&domain_url=${encodeURIComponent(url.value)}`
    const response = await fetch(googleUrl)
    if (response.ok) {
      faviconUrl.value = googleUrl
    }
  } catch {
    return ''
  }
}

const useWebsiteIcon = () => {
  icon.value = undefined
}

onMounted(() => {
  watch(() => props.webapp, () => {
    name.value = props.webapp?.name || ''
    url.value = props.webapp?.url || ''
    icon.value = props.webapp?.icon
    updateFaviconUrl()
    preserveColors.value = props.webapp?.preserveColors ?? false
    enabled.value = props.webapp?.enabled ?? true
  }, { deep: true, immediate: true })
})

const close = () => {
  emit('webapp-modified', null)
}

const onCancel = () => {
  close()
}

const onSave = (event: Event) => {
  // Not in input field
  if ((event.target as HTMLElement).nodeName.toLowerCase() === 'input') {
    return
  }

  // Validate
  if (!name.value || !url.value) {
    event.preventDefault()
    Dialog.alert(t('webapps.validation.requiredFields'))
    return
  }

  // Emit the modified webapp
  emit('webapp-modified', {
    id: props.webapp?.id,
    name: name.value,
    url: url.value,
    icon: icon.value ?? faviconUrl.value,
    preserveColors: preserveColors.value,
    enabled: enabled.value
  })
}

</script>

<style scoped>

.icon-selection {
  display: flex;
  gap: 1rem;
  flex-direction: column;
}

.icon-option {
  padding: 1rem 2rem;
  border: 1px solid var(--control-border-color);
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 2rem;

  span {
    margin-top: 0px !important;
  }

  &.active {
    border-color: var(--highlight-color);
  }

}

.icon-preview {
  
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;

  .favicon {
    width: 2rem;
    height: 2rem;
    &.grayscale {
      filter: grayscale() contrast(0) brightness(0.7);
    }
  }

  .placeholder-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--text-color);
    opacity: 0.5;
  }
}

</style>
