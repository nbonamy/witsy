
<template>
  <Teleport to="body">
    <dialog :id="id" class="dialog show" :class="[ type ]">
      <form :class="{ medium: true, vertical: form === 'vertical' }" method="dialog" @submit.prevent>
        <div class="icon" v-if="icon && type === 'alert'">
          <img src="/assets/icon.png" />
        </div>
        <header>
          <slot name="header"></slot>
        </header>
        <main>
          <slot name="body"></slot>
        </main>
        <footer>
          <slot name="footer"></slot>
        </footer>
      </form>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">

import { PropType } from 'vue'

export type DialogType = 'alert' | 'window'
export type DialogForm = 'horizontal' | 'vertical'

const emit = defineEmits(['save'])

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  width: {
    type: Number,
    default: 260
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

const show = () => {
  const dialog =  document.querySelector<HTMLDialogElement>(`#${props.id}`)
  if (!dialog) return
  dialog.classList.remove('hide')
  dialog.classList.add('show')
  dialog.showModal()
  dialog.addEventListener('keydown', onKeyDown)
}

const close = () => {
  const dialog =  document.querySelector<HTMLDialogElement>(`#${props.id}`)
  if (!dialog) return
  dialog.removeEventListener('keydown', onKeyDown)
  dialog.addEventListener('animationend', () => {
    dialog.close()
  }, { once: true })
  dialog.classList.remove('show')
  dialog.classList.add('hide')
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
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style scoped>

.dialog {
  width: v-bind(`${width}px`) !important;
}

</style>
