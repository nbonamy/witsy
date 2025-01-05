
<template>
  <dialog class="alert-dialog show">
    <form method="dialog" @submit.prevent>
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

  form {
    
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    padding-top: 26px;
    color: var(--text-color);

    .icon, .icon img {
      width: 60px;
      height: 60px;
      margin-bottom: 1.5rem;
    }

    .header:not(:empty) {
      margin-bottom: 1rem;
    }

    &:deep() .title {
      font-size: 10pt;
      line-height: 150%;
      font-weight: bold;
      text-align: center;
      margin-top: 12px;
    }

    &:deep() .text {
      font-size: 8.5pt;
      margin-top: 12px;
      padding: 0px 32px;
      text-align: center;
    }

    &:deep() .group {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 0.33rem !important;
      width: 100%;

      label {
        min-width: auto !important;
        margin-left: 2px;

        &::after {
          content: '' !important;
        }
      }

      .wrapper {
        width: 100%;
      }

    }

    &:deep().buttons {
      margin-top: 1rem;
      display: flex;
      flex-direction: row;
      justify-content: space-around;
      width: 100%;
      gap: 8px;

      button {
        box-sizing: border-box;
        width: auto !important;
        margin: 0px !important;
        padding: 4px 8px !important;
        border-radius: .3rem !important;
        box-shadow: 0px 2px 1.5px -2px rgba(0, 0, 0, .3) !important;
        font-size: 10pt !important;
        font-weight: normal !important;
        flex: 1;
      }
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