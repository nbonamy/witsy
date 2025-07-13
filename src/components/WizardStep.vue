
<template>
  <div class="list-large-with-header" v-if="visible">
    <div class="header">
      <slot name="header"></slot>
      <BIconChevronDoubleDown v-if="!expanded" />
    </div>
    <div class="list" v-if="expanded">
      <slot name="content"></slot>
      <div class="footer group">
        <slot name="footer">
          <div class="error" v-if="error">{{ error }}</div>
          <button @click.prevent.stop="emit('next')">{{ t('common.wizard.next') }}</button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { BIconChevronDoubleDown } from 'bootstrap-icons-vue';
import { t } from '../services/i18n'

const emit = defineEmits(['click', 'next'])

defineProps({
  visible: {
    type: Boolean,
    default: true
  },
  expanded: {
    type: Boolean,
    default: true
  },
  error: {
    type: String,
    default: ''
  }
})

</script>

<style scoped>
@import '../../css/list-large-with-header.css';
</style>

<style scoped>


.list-large-with-header {

  margin: 0 !important;
  padding: 0.75rem 0 !important;

  &:first-child {
    padding-top: 0 !important;
  }

  .header {
    padding: 1rem;
  }

  .header, .header:deep() label {
    cursor: pointer;
  }

  &:not(:has(.list)) .header {
    border-bottom-width: initial;
    border-bottom-left-radius: 0.5rem;
    border-bottom-right-radius: 0.5rem;
  }

  .list {
    gap: 0rem;
  }

  .footer {

    margin-top: 1rem;
    display: flex;
    justify-content: flex-end;
    align-items: center;

    button {
      padding: 0.375rem 0.75rem;
      font-size: 1em;
    }

    &:deep() .error {
      color: red;
      margin-right: 1rem;
    }
  }

}

</style>