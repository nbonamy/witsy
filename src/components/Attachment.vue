
<template>
  <BIconFilePdf class="icon" v-if="attachment.format === 'pdf'"/>
  <BIconFileText class="icon" v-else-if="attachment.format === 'txt'"/>
  <BIconFileText class="icon" v-else-if="attachment.format === 'docx'"/>
  <BIconFileBarGraph class="icon" v-else-if="attachment.format === 'xlsx'"/>
  <BIconFileRichtext class="icon" v-else-if="attachment.format === 'pptx'"/>
  <img :src="imageSrc" class="image" @click="emit('image-click', imageSrc)" v-else />
</template>

<script setup>

import { computed } from 'vue'
import Attachment from '../models/attachment'

const emit = defineEmits(['image-click'])

const props = defineProps({
  attachment: Attachment,
})

const imageSrc = computed(() => {
  if (props.attachment?.contents) {
    return 'data:image/png;base64,' + props.attachment.contents
  } else {
    return props.attachment?.url
  }
})

</script>
