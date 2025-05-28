
<template>
  <div class="menu">
    <div></div>
    <div></div>
    <div></div>
  </div>
</template>

<style scoped>

.menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;

  div {
    width: 16px;
    height: 1.5px;
    background-color: var(--chatarea-toolbar-icon-color);
  }
}

</style>