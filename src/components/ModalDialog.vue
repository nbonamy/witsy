
<template>
  <Teleport to="body">
    <div :id="id" class="dialog swal2-center swal2-backdrop-show" :class="klass" v-bind="$attrs" ref="dialog">
      <div class="swal2-popup swal2-show form form-large" :class="{ 'form-vertical': form === 'vertical' }" :style="style">
        <div class="swal2-icon swal2-icon-show" v-if="icon && type === 'alert'">
          <div class="swal2-icon-content">
            <img src="/assets/icon.png" />
          </div>
        </div>
        <h2 class="swal2-title">
          <slot name="header"></slot>
        </h2>
        <div class="swal2-html-container">
          <slot name="body"></slot>
        </div>
        <div class="swal2-actions" ref="actions">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">

import { PropType, computed, ref } from 'vue'

export type DialogType = 'alert' | 'window'
export type DialogForm = 'horizontal' | 'vertical'

const visible = ref(false)
const dialog = ref<HTMLElement|null>(null)
const actions = ref<HTMLElement|null>(null)

const emit = defineEmits(['save'])

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  width: {
    type: Number,
    default: undefined
  },
  type: {
    type: String as PropType<DialogType>,
    default: 'alert'
  },
  icon: {
    type: Boolean,
    default: true
  },
  form: {
    type: String as PropType<DialogForm>,
    default: 'vertical'
  }
})

const klass = computed(() => {
  return {
    'swal2-container': visible.value,
    visible: visible.value,
    [props.type]: visible.value
  }
})

const style = computed(() => {
  return {
    ...(props.width ? { width: `${props.width}px` } : {}),
  }
})

const show = () => {

  // backwards compatibility with old dialogs
  const buttons = actions.value.querySelector('.buttons')
  if (buttons) {
    const children = Array.from(buttons.childNodes)
    for (let i = children.length - 1; i >= 0; i--) {

      // style it
      const button = children[i] as HTMLElement
      button.classList.add('swal2-styled')
      if (button.classList.contains('default') || button.classList.contains('alert-confirm')) {
        button.classList.add('swal2-confirm')
        button.classList.add('alert-confirm')
      } else {
        button.classList.add('swal2-cancel')
        button.classList.add('alert-neutral')
      }

      // now move it
      
      actions.value.insertBefore(button, buttons)
    }

    // remove the container
    buttons.remove()
  }

  // now we can show it
  visible.value = true
  document.addEventListener('keydown', onKeyDown)
}

const close = () => {
  document.removeEventListener('keydown', onKeyDown)
  visible.value = false
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    emit('save')
  }
}

defineExpose({ show, close })

</script>


<style scoped>

.dialog {
  display: none;
  &.visible {
    display: grid;
  }
}

</style>
