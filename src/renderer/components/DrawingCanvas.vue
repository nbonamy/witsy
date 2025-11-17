<template>
  <div class="drawing-canvas-overlay">
    <div class="drawing-canvas-dialog  form form-large" @click.stop>
      
      <div class="drawing-canvas-header">
        <h3>{{ t('drawingCanvas.title') }}</h3>
      </div>
      
      <div class="drawing-canvas-controls">
        <div class="toolbar-section">
          
          <div class="toolbar-group">
            <button @click="undo"><UndoIcon /></button>
            <button @click="redo"><RedoIcon /></button>
          </div>

          <button @click="reset" title="Clear">
            <Trash2Icon />
          </button>

          <div class="button-group">
            <button @click="setMode('draw')" :class="{ active: mode === 'draw' }" title="Draw">
              <PencilIcon />
            </button>
            <button @click="setMode('erase')" :class="{ active: mode === 'erase' }" title="Erase">
              <EraserIcon />
            </button>
          </div>
          
          <input type="color" v-model="strokeColor" :disabled="mode === 'erase'" />
          
          <div class="size-control">
            <select v-model="strokeWidth" title="Brush Size">
              <option v-for="size in fibonacciSizes" :key="size" :value="size">
                {{ size }}px
              </option>
            </select>
          </div>
          
        </div>
      </div>
      
      <div class="drawing-canvas-container">
        <VueDrawingCanvas
          ref="canvas"
          v-if="backgroundImageCalculated"
          v-model:image="image"
          :width="canvasWidth"
          :height="canvasHeight"
          :stroke-type="strokeType"
          :fill-shape="fillShape"
          :line-join="lineJoin"
          :line-cap="lineCap"
          :lineWidth="strokeWidth"
          :color="strokeColor"
          :eraser="mode === 'erase'"
          :background-color="backgroundColor"
          :background-image="backgroundImageDataUrl"
          saveAs="png"
          :styles="{
            border: '2px solid var(--window-decoration-color)',
            borderRadius: '4px',
            backgroundColor: '#FFFFFF'
          }"
        />
      </div>
      
      <div class="drawing-canvas-footer">
        <button @click="onClose">
          {{ t('common.cancel') }}
        </button>
        <button @click="onSave" class="default">
          {{ t('drawingCanvas.useDrawing') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EraserIcon, PencilIcon, RedoIcon, Trash2Icon, UndoIcon } from 'lucide-vue-next'
import { nextTick, onMounted, ref } from 'vue'
import VueDrawingCanvas from 'vue-drawing-canvas'
import { t } from '../services/i18n'

const props = defineProps({
  backgroundImage: {
    type: String,
    default: null
  },
})

const emit = defineEmits(['close', 'save'])

const canvas = ref(null)
const mode = ref<'draw' | 'erase'>('draw')
const strokeColor = ref('#000000')
const strokeWidth = ref(5)
const strokeType = ref('dash')
const lineCap = ref('round')
const lineJoin = ref('round')
const fillShape = ref(false)
const backgroundColor = ref('#FFFFFF')
const image = ref('')

const fibonacciSizes = [1, 2, 3, 5, 8, 13, 21, 34]

const canvasWidth = ref(800)
const canvasHeight = ref(500)

// Reactive ref for the resized background image data URL
const backgroundImageCalculated = ref(false)
const backgroundImageDataUrl = ref<string | null>(null)

onMounted(async () => {
  if (props.backgroundImage) {
    try {
      const resizedDataUrl = await resizeImageToCanvas(props.backgroundImage)
      backgroundImageDataUrl.value = resizedDataUrl
    } catch (error) {
      console.error('Error resizing background image:', error)
      backgroundImageDataUrl.value = null
    }
  } else {
    backgroundImageDataUrl.value = null
  }
  backgroundImageCalculated.value = true
})

const resizeImageToCanvas = (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      
      // Calculate aspect ratio preserving dimensions
      const imageAspectRatio = img.width / img.height
      const canvasAspectRatio = canvasWidth.value / canvasHeight.value
      
      let newWidth: number
      let newHeight: number
      
      // Determine which dimension is the limiting factor
      if (imageAspectRatio > canvasAspectRatio) {
        // Image is wider relative to canvas - width is the limiting factor
        newWidth = canvasWidth.value
        newHeight = canvasWidth.value / imageAspectRatio
      } else {
        // Image is taller relative to canvas - height is the limiting factor
        newHeight = canvasHeight.value
        newWidth = canvasHeight.value * imageAspectRatio
      }
      
      // Create virtual canvas for resizing
      const virtualCanvas = document.createElement('canvas')
      virtualCanvas.width = canvasWidth.value
      virtualCanvas.height = canvasHeight.value
      const ctx = virtualCanvas.getContext('2d')
      
      if (ctx) {
        // Clear canvas with white background
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)
        
        // Center the image on the canvas
        const x = (canvasWidth.value - newWidth) / 2
        const y = (canvasHeight.value - newHeight) / 2
        
        // Draw resized image
        ctx.drawImage(img, x, y, newWidth, newHeight)
        
        // Convert to data URL
        const dataUrl = virtualCanvas.toDataURL('image/png')
        resolve(dataUrl)
      } else {
        reject(new Error('Could not get canvas context'))
      }
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imageUrl
  })
}

const setMode = (newMode: 'draw' | 'erase') => {
  mode.value = newMode
}

const undo = () => {
  if (canvas.value) {
    canvas.value.undo()
  }
}

const redo = () => {
  if (canvas.value) {
    canvas.value.redo()
  }
}

const reset = async () => {
  if (canvas.value) {
    backgroundImageCalculated.value = false
    await nextTick()
    backgroundImageDataUrl.value = null
    backgroundImageCalculated.value = true
  }
}

const onClose = () => {
  emit('close')
}

const onSave = async () => {
  if (image.value) {
    try {
      const dataURL = image.value
      
      const base64Data = dataURL.split(',')[1]
      
      const fileUrl = window.api.file.save({
        contents: base64Data,
        properties: {
          directory: 'temp',
          filename: `drawing-${Date.now()}.png`
        }
      })
      
      emit('save', {
        url: fileUrl,
        mimeType: 'image/png',
        filename: 'drawing.png',
      })
    } catch (error) {
      console.error('Error saving drawing:', error)
    }
  }
}
</script>

<style scoped>
.drawing-canvas-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.drawing-canvas-dialog {
  background: var(--background-color);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawing-canvas-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.drawing-canvas-header h3 {
  margin: 0;
  color: var(--text-color);
}

.close-button {
  cursor: pointer;
  font-size: 1.5rem;
}

.drawing-canvas-controls {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--background-color);
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  button {
    margin: 0;
  }

  .toolbar-group {
    display: flex;
    flex-direction: row;
    align-items: center;

    button:not(:last-child) {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }

    button:not(:first-child) {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  }

  input[type=color] {
    width: 2.25rem;
    height: 2.25rem;
  }

  .size-control select {
    height: 2.25rem;
  }

}

.drawing-canvas-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background-color: var(--background-color-secondary);
  overflow: auto;
  min-height: 400px;
}

.drawing-canvas-footer {
  display: flex;
  justify-content: flex-end;
  padding: 1rem;
}

</style>
