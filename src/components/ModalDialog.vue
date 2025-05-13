
<template>
  <Teleport to="body">
    <dialog :id="id" class="dialog show" :class="{ 'alert-dialog': !editor, editor: editor }">
      <form :class="{ vertical: !editor }" method="dialog" @submit.prevent>
        <div class="icon" v-if="icon && !editor">
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
  editor: {
    type: Boolean,
    default: false
  },
  icon: {
    type: Boolean,
    default: true
  }
})

const show = (id: string) => {
  const dialog =  document.querySelector<HTMLDialogElement>(id)
  if (!dialog) return
  dialog.classList.remove('hide')
  dialog.classList.add('show')
  dialog.showModal()
  dialog.addEventListener('keydown', onKeyDown)
}

const close = (id: string) => {
  const dialog =  document.querySelector<HTMLDialogElement>(id)
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
    close(props.id)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    emit('save')
  }
}

defineExpose({ show, close })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/editor.css';
@import '../../css/form.css';
</style>

<style scoped>

.alert-dialog {
  
  width: v-bind(`${width}px`) !important;

  &.show {
    animation: show 0.3s;
  }

  &.hide {
    animation: hide 0.15s forwards;
  }

  form.vertical {
    padding: 16px;
    padding-top: 26px;
    
    .icon, .icon img {
      width: 60px;
      height: 60px;
      margin-bottom: 1.5rem;
    }
  }

}

@keyframes show {
  0% { transform: scale(0.7); }
  45% { transform: scale(1.05); }
  80% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

@keyframes hide {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.5); opacity: 0; }
}

</style>