
<template>
  <div class="panel" v-if="visible">
    <div class="panel-header">
      <slot name="header"></slot>
    </div>
    <div class="panel-body">
      <slot name="content"></slot>
      <div class="footer form-field">
        <slot name="footer">
          <div class="error" v-if="error">{{ error }}</div>
          <button @click="emit('prev')" v-else>{{ prevButtonText }}</button>
          <slot name="buttons" />
          <button class="default" @click="emit('next')">{{ nextButtonText }}</button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { t } from '../services/i18n'

const emit = defineEmits(['cancel', 'prev', 'next'])

defineProps({
  visible: {
    type: Boolean,
    default: true
  },
  error: {
    type: String,
    default: ''
  },
  prevButtonText: {
    type: String,
    default: t('common.wizard.prev')
  },
  nextButtonText: {
    type: String,
    default: t('common.wizard.next')
  },
})

</script>


<style scoped>


.panel {

  .panel-header {
    padding: 1.25rem;
  }

  .panel-body {

    gap: 0rem;

    .footer {

      margin-top: 1rem;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;

      .error {
        color: red;
        margin-right: 1rem;
      }
    }

  }

}

</style>