
<template>
  <dialog class="alert-dialog show">
    <form class="vertical" method="dialog" @submit.prevent>
      <div class="icon">
        <img src="/assets/icon.png" alt="RAG Logo" />
      </div>
      <div class="header">
        <slot name="header"></slot>
      </div>
      <slot name="body"></slot>
      <slot name="footer"></slot>
    </form>
  </dialog>
</template>

<script setup lang="ts">

defineExpose({
  show(id: string) {
    const dialog =  document.querySelector<HTMLDialogElement>(id)
    dialog.classList.remove('hide')
    dialog.classList.add('show')
    dialog.showModal()
  },
  close(id: string) {
    const dialog =  document.querySelector<HTMLDialogElement>(id)
    dialog.addEventListener('animationend', () => {
      dialog.close()
    }, { once: true })
    dialog.classList.remove('show')
    dialog.classList.add('hide')
  }
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style scoped>

.alert-dialog {
  
  width: 260px !important;

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