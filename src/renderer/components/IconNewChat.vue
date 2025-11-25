
<template>
  <div class="wrapper">
    <MessageCircleIcon class="chat" />
    <PlusIcon class="plus"/>
  </div>
</template>

<script setup lang="ts">
import { MessageCircleIcon, PlusIcon } from 'lucide-vue-next';

</script>

<style scoped>

.wrapper {
  
  position: relative;
  width: var(--icon-md);
  height:var(--icon-md);
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