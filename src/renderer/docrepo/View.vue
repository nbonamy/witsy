<template>
  <ViewLocal :selectedRepo="selectedRepo" />
</template>

<script setup lang="ts">
import { DocumentBase } from '../../types/rag';

import ViewLocal from './View.Local.vue';

defineProps<{
  selectedRepo: DocumentBase | null
}>()

</script>
