
<template>
  <span ref="flipRef"></span>
</template>

<script setup lang="ts">

import { ref, watch, onMounted, PropType } from 'vue'
import { NumberFlip } from 'number-flip-animation'

type Formatter = (num: number) => string;

let flip: NumberFlip
const flipRef = ref<HTMLElement>(null)

const props = defineProps({
 value: {
    type: Number,
    required: true,
  },
  animateInitialNumber: {
    type: Boolean,
    default: true,
  },
  formatter: {
    type: Function as PropType<Formatter>,
    default: (value: number) => value.toLocaleString(),
  }
})

onMounted(() => {

  watch(() => props.value, (newValue, oldValue) => {
    if (flip === undefined) {
      flip = new NumberFlip({
        rootElement: flipRef.value,
        numberFormatter: props.formatter,
        animateInitialNumber: props.animateInitialNumber,
        initialNumber: newValue,
      })
    } else if (newValue != oldValue) {
      flip.setNumber(newValue)
    }
  }, { immediate: true })

})

</script>

<style>
@import '../../node_modules/number-flip-animation/dist/styles.css';
</style>

