
<template>

  <div @click="emit('click', attachment)" v-if="attachment.isText()">
    <BIconFilePdf class="icon" v-if="attachment.format() === 'pdf'"/>
    <BIconFileBarGraph class="icon" v-else-if="attachment.format() === 'xlsx'"/>
    <BIconFileRichtext class="icon" v-else-if="attachment.format() === 'pptx'"/>
    <BIconFiletypeCsv class="icon" v-else-if="attachment.format() === 'csv'"/>
    <BIconFiletypeJson class="icon" v-else-if="attachment.format() === 'json'"/>
    <BIconFiletypeHtml class="icon" v-else-if="attachment.format() === 'html'"/>
    <BIconFileText class="icon" v-else />
  </div>
  <img :src="imageSrc" class="image" @click="emit('image-click', imageSrc)" v-else />
</template>

<script setup lang="ts">

import { computed } from 'vue'
import Attachment from '../models/attachment'

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
