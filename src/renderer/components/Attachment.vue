
<template>
  <component :is="icon" class="icon" v-if="attachment.isText()" @click="emit('click', attachment)" />
  <img :src="imageSrc" class="image" @click="emit('image-click', imageSrc)" v-else />
</template>

<script setup lang="ts">

import { BarChart3Icon, FileCodeIcon, FileSpreadsheetIcon, FileTextIcon } from 'lucide-vue-next'
import { codeFormats, configFormats } from 'multi-llm-ts'
import { computed } from 'vue'
import Attachment from '@models/attachment'

const emit = defineEmits(['click', 'image-click'])

const props = defineProps({
  attachment: {
    type: Attachment,
    required: true,
  }
})

const icon = computed(() => {
  switch (props.attachment.format()) {
    case 'xlsx':
      return BarChart3Icon
    case 'csv':
      return FileSpreadsheetIcon
    default:
      if (codeFormats.includes(props.attachment.format()) || configFormats.includes(props.attachment.format())) {
        return FileCodeIcon
      } else {
        return FileTextIcon
      }
  }
})

const imageSrc = computed(() => {
  if (props.attachment?.content) {
    return `data:${props.attachment.mimeType};base64,${props.attachment.content}`
  } else {
    return props.attachment?.url
  }
})

</script>
