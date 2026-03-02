<template>
  <div>
    <div
      class="outline-heading"
      :class="{ active: isActive }"
      :data-level="level"
      :data-heading-id="heading.id"
      @click="$emit('navigate', heading)"
      :title="heading.text"
    >
      {{ heading.text }}
    </div>
    <!-- Recursively render children -->
    <template v-if="heading.children && heading.children.length > 0">
      <OutlineHeadingItem
        v-for="child in heading.children"
        :key="child.id"
        :heading="child"
        :level="child.level"
        :active-heading-id="activeHeadingId"
        @navigate="$emit('navigate', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OutlineHeading } from '@composables/useOutline'

const props = defineProps<{
  heading: OutlineHeading
  level: number
  activeHeadingId?: string | null
}>()

defineEmits<{
  navigate: [heading: OutlineHeading]
}>()

const isActive = computed(() => props.activeHeadingId === props.heading.id)
</script>

<style scoped>
.outline-heading {
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
  font-size: var(--font-size-14);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-on-surface);
  transition: background-color 0.15s ease;
  border-radius: var(--radius-sm);
}

.outline-heading:hover {
  background-color: var(--color-surface-low);
}

.outline-heading.active {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--font-weight-semibold);
}

/* Hierarchical indentation */
.outline-heading[data-level="1"] { padding-left: var(--space-4); }
.outline-heading[data-level="2"] { padding-left: var(--space-6); }
.outline-heading[data-level="3"] { padding-left: var(--space-8); }
.outline-heading[data-level="4"] { padding-left: var(--space-10); }
.outline-heading[data-level="5"] { padding-left: var(--space-12); }
.outline-heading[data-level="6"] { padding-left: var(--space-16); }
</style>
