
<template>
  <div class="loader"></div>
</template>

<script setup>
</script>

<style scoped>
/* HTML: <div class="loader"></div> */
.loader {
  padding: 16px 0;
  width: 30px;
  aspect-ratio: 10;
  --_g: no-repeat radial-gradient(circle closest-side,#444 50%,#4440);
  --_w: 25%;
  background: 
    var(--_g) 0%   50%,
    var(--_g) 50%  50%,
    var(--_g) 100% 50%;
  background-size: var(--_w) 100%;
  animation: l7 1.5s infinite linear;
}
@keyframes l7 {
    17%{background-size:var(--_w) 0%  ,var(--_w) 100%,var(--_w) 100%}
    50%{background-size:var(--_w) 100%,var(--_w) 0%  ,var(--_w) 100%}
    84%{background-size:var(--_w) 100%,var(--_w) 100%,var(--_w) 0%  }
}

</style>
