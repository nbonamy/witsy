
<template>
  <div class="wrapper">
    <BIconChatLeft class="chat" />
    <BIconPlus class="plus"/>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>

.wrapper {
  
  position: relative;
  width: 1rem;
  height: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;

  svg {
    position: absolute;
    top: 0.5px;
    left: 0;

    &.chat {
      transform: scaleY(110%);
    }

    &.plus {
      transform: scale(80%);
      margin-top: -2.5px;
    }
  }
}

</style>