<template>
  <div class="panel hero-panel" :class="variant">
    <div class="panel-header">
      <label>
        <slot name="title"></slot>
        <div class="subtitle"><slot name="subtitle"></slot></div>
      </label>
    </div>
    <div class="panel-body">
      <slot name="body">
        <!-- If no body slot is provided, render button slot -->
        <button v-if="$slots.button" class="cta with-icon" @click="handleButtonClick">
          <slot name="button"></slot>
        </button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  variant?: string
}>()

const emit = defineEmits<{
  'button-click': []
}>()

const handleButtonClick = () => {
  emit('button-click')
}
</script>

<style scoped>
.hero-panel {
  border: none;

  .panel-body {
    button {
      align-self: flex-start;
    }
  }
}

.hero-panel.online {
  background: rgba(231, 242, 245, 0.60);
}

.hero-panel.local {
  background: rgba(235, 239, 254, 0.60);
}
</style>