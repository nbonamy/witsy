<template>
  <div class="color-picker">
    <div class="palette" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }" >
      <div
        v-for="(c, i) in swatches"
        :key="`swatch-${i}`"
        type="button"
        class="swatch"
        :aria-label="c"
        :title="c"
        :class="{ selected: isSelected(c) }"
        :style="{ backgroundColor: c }"
        @click="select(c)"
      />

      <!-- <label class="swatch custom">
        <input
          type="color"
          :value="modelValue || defaultColor"
          @input="onCustom($event)"
          aria-label="Custom color"
          title="Custom color"
        />
      </label> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string | null | undefined
  columns?: number
  rows?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const columns = computed(() => props.columns ?? 12)
const rows = computed(() => props.rows ?? 4)

function generatePalette(rows: number, cols: number): string[] {
  const items: string[] = []
  const lightnessStart = 64
  const lightnessEnd = 32
  const sat = 128
  for (let r = 0; r < rows; r++) {
    const l = Math.round(lightnessStart + (lightnessEnd - lightnessStart) * (r / (rows - 1)))
    for (let c = 0; c < cols; c++) {
      const hue = Math.round((360 * c) / cols) // wrap around color wheel
      items.push(`hsl(${hue}deg ${sat}% ${l}%)`)
    }
  }
  return items
}

const swatches = computed<string[]>(() => {
  return generatePalette(rows.value, columns.value)
})

function select(c: string) {
  emit('update:modelValue', toHexIfNeeded(c))
}

function isSelected(c: string) {
  if (!props.modelValue) return false
  return normalizeColor(props.modelValue) === normalizeColor(c)
}

// function onCustom(e: Event) {
//   const input = e.target as HTMLInputElement
//   if (input?.value) emit('update:modelValue', input.value)
// }

function normalizeColor(color: string) {
  const hex = toHexIfNeeded(color)?.toLowerCase()
  return hex || color
}

function toHexIfNeeded(color: string): string {
  const c = color.trim()
  if (c.startsWith('#')) return c

  // Try CSS Typed OM via a temporary element to resolve to rgb and hex
  try {
    const el = document.createElement('div')
    el.style.color = c
    document.body.appendChild(el)
    const rgb = getComputedStyle(el).color // e.g. "rgb(255, 0, 0)"
    document.body.removeChild(el)
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
    if (!match) return color
    const r = Number(match[1])
    const g = Number(match[2])
    const b = Number(match[3])
    return (
      '#' +
      [r, g, b]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
        .toLowerCase()
    )
  } catch {
    return color
  }
}
</script>

<style scoped>
.color-picker {
  display: inline-block;
  width: 100%;

  .palette {
    display: grid;
    width: 100%;
  }

  .swatch {
    position: relative;
    height: 1.4rem;
    cursor: pointer;
    padding: 0;
    outline: none;
  }

  .swatch.selected {
    outline: 2px solid white;
    outline-offset: -2px;
  }

  /* .swatch.custom {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background:
      linear-gradient(45deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    border: 1px solid var(--control-border-color);
  }

  .swatch.custom input[type="color"] {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    background: transparent;
    width: 100%;
    height: 100%;
    padding: 0;
    cursor: pointer;
    opacity: 0;
  } */

}

</style>