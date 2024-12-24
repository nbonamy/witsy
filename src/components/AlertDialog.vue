
<template>
  <dialog class="alert-dialog swal2-show">
    <form method="dialog" @submit.prevent>
      <div class="icon">
        <img src="/assets/icon.png" alt="RAG Logo" />
      </div>
      <slot name="body"></slot>
      <div class="buttons">
        <slot name="footer"></slot>
      </div>
    </form>
  </dialog>
</template>

<script setup lang="ts">

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style>

.alert-dialog {
  
  width: 260px !important;

  form {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    padding-top: 26px
  }

  .icon, .icon img {
    width: 60px;
    height: 60px;
    margin-bottom: 1.5rem;
  }

  form .group {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 0.33rem !important;
    width: 100%;

    label {
      min-width: auto !important;
      margin-left: 2px;
      color: var(--text-color);

      &::after {
        content: '' !important;
      }
    }
  }

  input, select {
    width: 100%;
  }

  .buttons {
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

</style>