
<template>
  <select name="locale" v-model="locale" @change="emit('change')">
    <option value="">{{ $t(defaultText) }}</option>
    <option v-for="language in languages" :key="language.locale" :value="language.locale">
      {{ language.label }}
    </option>
    <option v-for="language in extraLanguages" :key="language.locale" :value="language.locale">
      {{ language.label }}
    </option>
  </select>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { allLanguages } from '@services/i18n'

const locale = defineModel()

const props = defineProps({
  defaultText: {
    type: String,
    default: 'common.language.auto'
  },
  filter: {
    type: Array<string>,
    default: []
  }
})

const isVisible = (locale: string): boolean => {
  try {
    if (props.filter.length == 0) return true
    return props.filter.includes(locale.substring(0, 2))
  } catch (e) {
    return true
  }
}

const languages = computed(() => allLanguages.filter(language => isVisible(language.locale)))

const extraLanguages = computed(() => {
  return props.filter.filter(locale => !allLanguages.map(language => language.locale.substring(0, 2)).includes(locale))
    .map(locale => ({ locale, label: locale }))
})

const emit = defineEmits(['change']);

</script>


<style scoped>

.windows {
  select, select option {
    font-family: 'NotoColorEmojiLimited', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
}

</style>