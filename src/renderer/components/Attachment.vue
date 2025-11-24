
<template>

  <div @click="emit('click', attachment)" v-if="attachment.isText()">
    <FileTextIcon class="icon" v-if="attachment.format() === 'pdf'"/>
    <BarChart3Icon class="icon" v-else-if="attachment.format() === 'xlsx'"/>
    <FileTextIcon class="icon" v-else-if="attachment.format() === 'pptx'"/>
    <FileSpreadsheetIcon class="icon" v-else-if="attachment.format() === 'csv'"/>
    <FileJsonIcon class="icon" v-else-if="attachment.format() === 'json'"/>
    <FileCodeIcon class="icon" v-else-if="attachment.format() === 'html'"/>
    <FileTextIcon class="icon" v-else />
  </div>
  <img :src="imageSrc" class="image" @click="emit('image-click', imageSrc)" v-else />
</template>

<script setup lang="ts">

import { BarChart3Icon, FileCodeIcon, FileJsonIcon, FileSpreadsheetIcon, FileTextIcon } from 'lucide-vue-next'
import { computed } from 'vue'
import Attachment from '@models/attachment'

const emit = defineEmits(['click', 'image-click'])

const props = defineProps({
  attachment: {
    type: Attachment,
    required: true,
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
