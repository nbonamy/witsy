
<template>
  <BIconFilePdf class="icon" v-if="attachment.format() === 'pdf'"/>
  <BIconFileText class="icon" v-else-if="attachment.format() === 'txt'"/>
  <BIconFileText class="icon" v-else-if="attachment.format() === 'docx'"/>
  <BIconFiletypeCsv class="icon" v-else-if="attachment.format() === 'csv'"/>
  <BIconFileBarGraph class="icon" v-else-if="attachment.format() === 'xlsx'"/>
  <BIconFileRichtext class="icon" v-else-if="attachment.format() === 'pptx'"/>
  <img :src="imageSrc" class="image" @click="emit('image-click', imageSrc)" v-else />
</template>

<script setup lang="ts">

import { computed } from 'vue'
import Attachment from '../models/attachment'
import { BIconFiletypeCsv } from 'bootstrap-icons-vue';

const emit = defineEmits(['image-click'])

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
