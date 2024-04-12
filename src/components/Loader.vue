
<template>
  <div class="loader"></div>
</template>

<script setup>
</script>

<style scoped>
/* HTML: <div class="loader"></div> */
.loader {
  margin: 16px 0px;
  width: 8px;
  height: 8px;
  background-color: #444;
  border-radius: 50%;
  animation: glow 1s infinite;
}

  /* Définition de l'animation */
  @keyframes glow {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.5); }
  }

</style>
