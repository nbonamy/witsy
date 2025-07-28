
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
          <button @click="emit('cancel')" v-if="backIsCancel">{{ t('common.cancel') }}</button>
          <button @click="emit('prev')" v-else>{{ t('common.wizard.prev') }}</button>
          <slot name="buttons" />
          <button class="default" @click="emit('next')">{{ t('common.wizard.next') }}</button>
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
  backIsCancel: {
    type: Boolean,
    default: false
  }
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