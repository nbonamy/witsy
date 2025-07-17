
<template>

  <section>

    <header>
      <img class="logo landing-logo" src="../../assets/icon.png" alt="Witsy Logo" />
      <h1 class="title-text">{{ t('onboarding.done.title') }}</h1>
      <h3 class="subtitle-text" v-html="t('onboarding.done.subtitle')"></h3>
    </header>

  </section>

</template>

<script setup lang="ts">

import { t } from '../services/i18n'

</script>

<style scoped>

section {
  padding-top: 8rem;
  overflow: hidden;

  header {

    .logo {
      width: 8rem;
      height: 8rem;
    }

    .landing-logo {
      transform: scale(50);
      opacity: 0.3;
      animation: logoLanding 0.5s ease-out forwards;
    }

    .title-text {
      font-size: 2em;
      margin-top: 4rem;
      opacity: 0;
      transform: translateY(1rem);
      animation: fadeInUp 0.3s ease-out 0.5s forwards;
    }

    .subtitle-text {
      padding: 2rem 6rem !important;
      opacity: 0;
      transform: translateY(1rem);
      animation: fadeInUp 0.2s ease-out 0.6s forwards;
    }

  }

}

@keyframes logoLanding {
  0% {
    transform: scale(50);
    opacity: 0.3;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fadeInUp {
  0% {
    opacity: 0;
    transform: scale(2) translateY(1rem);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

</style>
