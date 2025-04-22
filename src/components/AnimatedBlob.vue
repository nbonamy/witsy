<template>
  <div class="blobs" :class="active ? 'active' : ''">
    <div class="blob blob1"></div>
    <div class="blob blob2"></div>
  </div>
</template>

<script setup lang="ts">

import { onMounted } from 'vue'

const props = defineProps({
  active: {
    type: Boolean,
    required: true,
  }
})


let blobTimeout: NodeJS.Timeout

onMounted(() => {
  update()
})

let transforms = [
  [0, 1, 50, 50, 50, 50],
  [0, 1, 50, 50, 50, 50],
]

const random = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));
const remain = (n: number) => 100 - n;

const update = () => {

  clearTimeout(blobTimeout);
  
  const offset = props.active ? 40 : 40;
  const scaling = props.active ? 100 : 50;
  const delay = props.active ? 250 : 2000;

  /* v8 ignore start */
  document.querySelectorAll<HTMLElement>('.blob').forEach((blob, idx) => {

    let rotation = transforms[idx][0]
    rotation += random(0, props.active ? 15 : 5);
    transforms[idx][0] = rotation;

    let scale = transforms[0][1];
    if (idx === 0) {
      scale += random(-scaling, scaling)/1000;
      scale = Math.max(0.95, Math.min(scale, 1.05));
      transforms[idx][1] = scale;
    }

    let r = [];
    for (let i = 0; i < 4; i++) {
      let v = transforms[idx][i+2];
      v += random(-5, 5);
      v = Math.max(offset, Math.min(v, remain(offset)));
      transforms[idx][i+2] = v;
      r.push(v);
      r.push(remain(v));
    }

    let coordinates = `${r[0]}% ${r[1]}% ${r[2]}% ${r[3]}% / ${r[4]}% ${r[6]}% ${r[7]}% ${r[5]}%`;
    blob.style.borderRadius = coordinates;
    blob.style.setProperty("--r", `${rotation}deg`);
    blob.style.setProperty("--s", `${scale}`);
    blob.style.setProperty("transition", `linear ${delay}ms`);

  });
  /* v8 ignore stop */

  blobTimeout = setTimeout(update, delay);

};

defineExpose({
  update
})

</script>

<style scoped>

.blobs {
  position: relative;
  width: 300px;
  height: 300px;
}

.blob {
  position: absolute;
  width: 300px;
  height: 300px;
  left: 0;
  top: 0;
  border-radius: 50%;
  overflow: hidden;
  transform: rotate(var(--r, 0)) scale(var(--s, --s));
}

.blob {
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0);
}

.blob1 {
  background: var(--text-color);
  opacity: 0.8;
}

.blob2 {
  background: var(--icon-color);
  opacity: 0.9;
}

.blobs.active .blob2 {
  background-color: var(--highlight-color);
  opacity: 0.5;
}

.blob, .blob div {
  transition-property: border-radius, transform;
}

</style>