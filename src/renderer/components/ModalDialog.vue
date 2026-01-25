
<template>
  <Teleport to="body">
    <div :id="id" class="dialog modal-container" :class="klass" v-bind="$attrs">
      <div class="modal-popup form form-large" :class="{ 'form-vertical': form === 'vertical' }" :style="popupStyle">
        <div class="modal-icon" v-if="icon && type === 'alert'">
          <div class="modal-icon-content">
            <img src="/assets/icon.png" />
          </div>
        </div>
        <h2 class="dialog-title modal-title">
          <slot name="header"></slot>
        </h2>
        <div class="dialog-body modal-body" ref="content" :style="bodyStyle">
          <slot name="body"></slot>
        </div>
        <div class="dialog-footer modal-actions" ref="actions">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">

import { PropType, computed, nextTick, ref } from 'vue'
import useEventListener from '@composables/event_listener'

export type DialogType = 'alert' | 'window'
export type DialogForm = 'horizontal' | 'vertical'

const { onDomEvent, offDomEvent } = useEventListener()

const visible = ref(false)
const content = ref<HTMLElement|null>(null)
const actions = ref<HTMLElement|null>(null)

const emit = defineEmits(['save'])

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  dismissible: {
    type: Boolean,
    default: true
  },
  width: {
    type: String,
    default: undefined
  },
  height: {
    type: String,
    default: undefined
  },
  type: {
    type: String as PropType<DialogType>,
    default: 'alert'
  },
  icon: {
    type: Boolean,
    default: false
  },
  form: {
    type: String as PropType<DialogForm>,
    default: 'vertical'
  },
  enterSaves: {
    type: Boolean,
    default: true
  }
})

const klass = computed(() => {
  return {
    'modal-backdrop': visible.value,
    visible: visible.value,
    [props.type]: visible.value
  }
})

const popupStyle = computed(() => {
  return {
    ...(props.width ? {
      width: `${props.width} !important`,
      maxWidth: `${props.width} !important`
    } : {}),
  }
})

const bodyStyle = computed(() => {
  return {
    ...(props.height ? {
      height: `${props.height} !important`,
    } : {}),
  }
})

const show = async () => {

  // backwards compatibility with old dialogs
  const buttons = actions.value.querySelector('.buttons')
  if (buttons) {
    const children = Array.from(buttons.childNodes)
    for (let i = children.length - 1; i >= 0; i--) {
      // move button out of the container
      const button = children[i] as HTMLElement
      actions.value.insertBefore(button, buttons)
    }

    // remove the container
    buttons.remove()
  }

  // now we can show it
  visible.value = true
  onDomEvent(document, 'keydown', onKeyDown)

  // wait render
  await nextTick()

  // focus 1st input
  if (content.value) {
    const input = content.value.querySelector('textarea') ?? content.value.querySelector('input') 
    if (input) {
      input.focus()
      input.select()
      if ('scrollTo' in input) {
        input.scrollTo(0, 0)
      }
    }
  }

}

const close = () => {
  offDomEvent(document, 'keydown', onKeyDown)
  visible.value = false
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    if (props.dismissible) {
      close()
    }
  } else if (e.key === 'Enter' && props.enterSaves) {
    const activeElement = document.activeElement
    if (activeElement && activeElement.tagName === 'TEXTAREA' && !activeElement.classList.contains('text-textarea')) {
      return
    }
    e.preventDefault()
    emit('save')
  }
}

defineExpose({ show, close })

</script>


<style scoped>

.dialog {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1060;
  overflow-x: hidden;
  overflow-y: auto;
  &.visible {
    display: grid;
    place-items: center;
  }
}

</style>