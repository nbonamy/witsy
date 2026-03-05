<template>
  <div class="alert-block" :class="variant">
    <div class="alert-header">
      <slot name="icon" />
      <span>{{ title }}</span>
    </div>
    <div class="alert-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">

withDefaults(defineProps<{
  title: string
  variant?: 'success' | 'info' | 'warning' | 'error'
}>(), {
  variant: 'info'
})

</script>

<style scoped>
.alert-block {
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.alert-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-semibold);

  svg {
    width: var(--icon-md);
    height: var(--icon-md);
    flex-shrink: 0;
  }
}

.alert-body {
  padding: var(--space-6) var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  font-size: var(--font-size-14);
  line-height: var(--line-height-20);

  &:deep() {
    p {
      margin: 0;
    }

    button {
      align-self: flex-start;
    }
  }
}

/* Error */
.alert-block.error {
  border: 1px solid var(--color-error);
  background-color: var(--color-error-container);
}

.alert-block.error .alert-header {
  background-color: var(--color-error);
  color: var(--color-on-error);
}

.alert-block.error .alert-body {
  color: var(--color-on-error-container);
}

/* Warning */
.alert-block.warning {
  border: 1px solid var(--color-warning);
  background-color: var(--color-warning-container);
}

.alert-block.warning .alert-header {
  background-color: var(--color-warning);
  color: var(--color-on-warning);
}

.alert-block.warning .alert-body {
  color: var(--color-on-warning-container);
}

/* Info */
.alert-block.info {
  border: 1px solid var(--color-secondary);
  background-color: var(--color-secondary-container);
}

.alert-block.info .alert-header {
  background-color: var(--color-secondary);
  color: var(--color-on-secondary);
}

.alert-block.info .alert-body {
  color: var(--color-on-secondary-container);
}

/* Success */
.alert-block.success {
  border: 1px solid var(--color-success);
  background-color: var(--color-success-container);
}

.alert-block.success .alert-header {
  background-color: var(--color-success);
  color: var(--color-on-success);
}

.alert-block.success .alert-body {
  color: var(--color-on-success-container);
}
</style>
