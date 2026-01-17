
<!-- https://codepen.io/jmak/pen/bGPzrQ -->

<template>
  <!-- macOS: native-style spinner blades -->
  <div class="spinner macos" v-if="platform === 'darwin'">
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
    <div class="spinner-blade"></div>
  </div>
  <!-- Other platforms: simple rotating circle -->
  <div class="spinner other" v-else>
    <LoaderCircleIcon />
  </div>
</template>

<script setup lang="ts">

import { LoaderCircleIcon } from 'lucide-vue-next'

const platform = window.api?.platform || 'darwin'

</script>

<style scoped>

.spinner {
  font-size: 12px;
  position: relative;
  display: inline-block;
  width: 1em !important;
  height: 1em !important;

  &.large {
    transform: scale(1.5);
  }
  &.xlarge {
    transform: scale(1.75);
  }
  &.xxlarge {
    transform: scale(1.2);
  }
}

/* macOS spinner blades */
.spinner.macos {

  .spinner-blade {
    position: absolute;
    left: 0.4629em;
    bottom: 0;
    width: 0.074em;
    height: 0.2777em;
    border-radius: 0.5em;
    background-color: transparent;
    transform-origin: center -0.2222em;
    -webkit-animation: spinner-fade 1s infinite linear;
            animation: spinner-fade 1s infinite linear;
  }
  .spinner-blade:nth-child(1) {
    -webkit-animation-delay: 0s;
            animation-delay: 0s;
    transform: rotate(0deg);
  }
  .spinner-blade:nth-child(2) {
    -webkit-animation-delay: 0.083s;
            animation-delay: 0.083s;
    transform: rotate(30deg);
  }
  .spinner-blade:nth-child(3) {
    -webkit-animation-delay: 0.166s;
            animation-delay: 0.166s;
    transform: rotate(60deg);
  }
  .spinner-blade:nth-child(4) {
    -webkit-animation-delay: 0.249s;
            animation-delay: 0.249s;
    transform: rotate(90deg);
  }
  .spinner-blade:nth-child(5) {
    -webkit-animation-delay: 0.332s;
            animation-delay: 0.332s;
    transform: rotate(120deg);
  }
  .spinner-blade:nth-child(6) {
    -webkit-animation-delay: 0.415s;
            animation-delay: 0.415s;
    transform: rotate(150deg);
  }
  .spinner-blade:nth-child(7) {
    -webkit-animation-delay: 0.498s;
            animation-delay: 0.498s;
    transform: rotate(180deg);
  }
  .spinner-blade:nth-child(8) {
    -webkit-animation-delay: 0.581s;
            animation-delay: 0.581s;
    transform: rotate(210deg);
  }
  .spinner-blade:nth-child(9) {
    -webkit-animation-delay: 0.664s;
            animation-delay: 0.664s;
    transform: rotate(240deg);
  }
  .spinner-blade:nth-child(10) {
    -webkit-animation-delay: 0.747s;
            animation-delay: 0.747s;
    transform: rotate(270deg);
  }
  .spinner-blade:nth-child(11) {
    -webkit-animation-delay: 0.83s;
            animation-delay: 0.83s;
    transform: rotate(300deg);
  }
  .spinner-blade:nth-child(12) {
    -webkit-animation-delay: 0.913s;
            animation-delay: 0.913s;
    transform: rotate(330deg);
  }

}

@-webkit-keyframes spinner-fade {
  0% { background-color: var(--text-color); }
  100% { background-color: transparent; }
}

@keyframes spinner-fade {
  0% { background-color: var(--text-color); }
  100% { background-color: transparent; }
}

/* Other platforms: rotating circle */
.spinner.other {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 1em;
    height: 1em;
    color: var(--text-color);
    opacity: 0.5;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

</style>
