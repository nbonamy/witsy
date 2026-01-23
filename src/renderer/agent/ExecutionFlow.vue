
<template>
  <div class="execution-flow" ref="containerRef">
    <canvas
      ref="canvasRef"
      @click="onCanvasClick"
      @wheel="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    ></canvas>
  </div>
</template>

<script setup lang="ts">

import { PropType, computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { Agent, AgentRun } from 'types/agents'
import AgentRunModel from '@models/agent_run'
import Message from '@models/message'

type StepNode = {
  type: 'agent' | 'step'
  index: number
  label: string
  description?: string
  status?: 'pending' | 'running' | 'success' | 'error'
  prompt?: Message
  response?: Message
}

const props = defineProps({
  agent: {
    type: Object as PropType<Agent>,
    required: true,
  },
  run: {
    type: Object as PropType<AgentRun>,
    default: null,
  },
  selectedIndex: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits<{
  select: [index: number]
}>()

const containerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Canvas state
const scale = ref(1)
const offsetY = ref(0)

// Animation state for running indicator
const pulsePhase = ref(0)
let pulseInterval: ReturnType<typeof setInterval> | null = null

// Mouse drag state
const isDragging = ref(false)
const didDrag = ref(false)
const dragStartY = ref(0)
const dragStartOffsetY = ref(0)
const canPan = ref(false)

// Hit targets stored during draw
type HitTarget = {
  index: number
  x: number
  y: number
  width: number
  height: number
}
const hitTargets = ref<HitTarget[]>([])

// Node dimensions
const nodeWidth = 200
const nodeHeight = 60
const nodeGap = 40
const nodePadding = 20

// Computed nodes from run data
const nodes = computed<StepNode[]>(() => {
  const result: StepNode[] = []

  // First node is always the agent
  result.push({
    type: 'agent',
    index: 0,
    label: props.agent.name,
    description: props.agent.description,
    status: props.run?.status === 'running' ? 'running' : 'success',
  })

  // Parse steps from run messages
  if (props.run) {
    const runModel = AgentRunModel.fromJson(props.run)
    const messages = runModel.messages || []

    // Skip system message, then pair user/assistant messages as steps
    if (messages.length > 1) {
      let stepIndex = 1
      for (let i = 1; i < messages.length; i += 2) {
        const promptMsg = messages[i]
        const responseMsg = messages[i + 1]
        const isLastStep = i + 2 >= messages.length

        const stepInfo = props.agent.steps?.[stepIndex - 1]
        const runStepInfo = props.run.agentInfo?.steps?.[stepIndex - 1]

        // Last step is running if agent is running
        const stepIsRunning = props.run?.status === 'running' && isLastStep
        result.push({
          type: 'step',
          index: stepIndex,
          label: `Step ${stepIndex}`,
          description: runStepInfo?.description || stepInfo?.description,
          status: stepIsRunning ? 'running' : (responseMsg ? 'success' : 'pending'),
          prompt: promptMsg,
          response: responseMsg,
        })

        stepIndex++
      }
    }
  }

  return result
})

// Draw industrial grid background
const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, borderColor: string) => {
  const gridSize = 16
  const majorGridSize = gridSize * 4 // Every 4 lines is a major line

  // Calculate grid offset based on pan position (vertical only)
  const gridOffsetY = -offsetY.value % gridSize
  const _majorGridOffsetY = -offsetY.value % majorGridSize

  ctx.save()

  // Draw minor grid lines
  ctx.strokeStyle = borderColor
  ctx.globalAlpha = 0.25
  ctx.lineWidth = 0.75
  ctx.beginPath()

  // Vertical lines (static, no offset)
  for (let x = 0; x <= width; x += gridSize) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }

  // Horizontal lines
  for (let y = gridOffsetY; y <= height; y += gridSize) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()

  // // Draw major grid lines
  // ctx.globalAlpha = 0.25
  // ctx.lineWidth = 1.25
  // ctx.beginPath()

  // // Major vertical lines (static)
  // for (let x = 0; x <= width; x += majorGridSize) {
  //   ctx.moveTo(x, 0)
  //   ctx.lineTo(x, height)
  // }

  // // Major horizontal lines
  // for (let y = _majorGridOffsetY; y <= height; y += majorGridSize) {
  //   ctx.moveTo(0, y)
  //   ctx.lineTo(width, y)
  // }
  // ctx.stroke()

  ctx.restore()
}

// Draw the canvas
const draw = () => {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Set canvas size to match container
  const rect = container.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  ctx.scale(dpr, dpr)

  // Clear canvas
  ctx.clearRect(0, 0, rect.width, rect.height)

  // Get computed styles for colors
  const styles = getComputedStyle(container)
  const textColor = styles.getPropertyValue('--text-color').trim() || '#333'
  const fadedColor = styles.getPropertyValue('--faded-text-color').trim() || '#999'
  const borderColor = styles.getPropertyValue('--border-color').trim() || '#ddd'
  const highlightColor = styles.getPropertyValue('--highlight-color').trim() || '#007bff'
  const bgColor = styles.getPropertyValue('--background-color').trim() || '#fff'

  // Update pan state and draw grid
  updateCanPan()
  drawGrid(ctx, rect.width, rect.height, borderColor)

  // Calculate total height of content
  const totalHeight = nodes.value.length * (nodeHeight + nodeGap) - nodeGap
  const scaledHeight = totalHeight * scale.value

  // Calculate dynamic top padding: add extra space if content fits comfortably
  let dynamicPadding = nodePadding
  const availableHeight = rect.height - nodePadding * 2
  if (scaledHeight < availableHeight * 0.8) {
    // Content is short - add extra padding (center vertically with some bias to top)
    dynamicPadding = 6 * nodePadding
  }

  // Apply scale and offset
  ctx.save()
  ctx.translate(rect.width / 2, dynamicPadding - offsetY.value)
  ctx.scale(scale.value, scale.value)

  // Draw connections first
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 2
  for (let i = 0; i < nodes.value.length - 1; i++) {
    const y1 = i * (nodeHeight + nodeGap) + nodeHeight
    const y2 = y1 + nodeGap
    ctx.beginPath()
    ctx.moveTo(0, y1)
    ctx.lineTo(0, y2)
    ctx.stroke()

    // Draw arrow
    ctx.beginPath()
    ctx.moveTo(-6, y2 - 8)
    ctx.lineTo(0, y2)
    ctx.lineTo(6, y2 - 8)
    ctx.stroke()
  }

  // Clear and rebuild hit targets
  hitTargets.value = []

  // Draw nodes
  nodes.value.forEach((node, i) => {
    const y = i * (nodeHeight + nodeGap)
    const x = -nodeWidth / 2
    const isSelected = props.selectedIndex === node.index

    // Store hit target in screen coordinates
    hitTargets.value.push({
      index: node.index,
      x: rect.width / 2 + x * scale.value,
      y: dynamicPadding + y * scale.value - offsetY.value,
      width: nodeWidth * scale.value,
      height: nodeHeight * scale.value,
    })

    // Node background
    ctx.fillStyle = isSelected ? highlightColor : bgColor
    ctx.strokeStyle = isSelected ? highlightColor : borderColor
    ctx.lineWidth = isSelected ? 2 : 1

    // Rounded rectangle
    const radius = 8
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + nodeWidth - radius, y)
    ctx.quadraticCurveTo(x + nodeWidth, y, x + nodeWidth, y + radius)
    ctx.lineTo(x + nodeWidth, y + nodeHeight - radius)
    ctx.quadraticCurveTo(x + nodeWidth, y + nodeHeight, x + nodeWidth - radius, y + nodeHeight)
    ctx.lineTo(x + radius, y + nodeHeight)
    ctx.quadraticCurveTo(x, y + nodeHeight, x, y + nodeHeight - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Node label (truncated)
    ctx.fillStyle = isSelected ? '#fff' : textColor
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let label = node.label
    if (label.length > 24) {
      label = label.substring(0, 21) + '...'
    }
    ctx.fillText(label, 0, y + (node.description ? nodeHeight / 3 : nodeHeight / 2))

    // Node description (truncated)
    if (node.description) {
      ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.8)' : fadedColor
      ctx.font = '12px system-ui, -apple-system, sans-serif'
      let desc = node.description
      if (desc.length > 30) {
        desc = desc.substring(0, 27) + '...'
      }
      ctx.fillText(desc, 0, y + nodeHeight * 2 / 3)
    }

    // Status indicator (small circle on the right)
    if (node.status) {
      const statusX = x + nodeWidth - 15
      const statusY = y + 15
      ctx.beginPath()
      ctx.arc(statusX, statusY, 5, 0, Math.PI * 2)
      switch (node.status) {
        case 'success':
          ctx.fillStyle = '#10b981'
          break
        case 'error':
          ctx.fillStyle = '#ef4444'
          break
        case 'running': {
          // Pulsing yellow dot - oscillate opacity between 0.4 and 1.0
          const opacity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(pulsePhase.value))
          ctx.fillStyle = `rgba(245, 158, 11, ${opacity})`
          break
        }
        default:
          ctx.fillStyle = fadedColor
      }
      ctx.fill()
    }
  })

  ctx.restore()
}

// Handle click on canvas
const onCanvasClick = (event: MouseEvent) => {
  // Skip if we just finished dragging
  if (didDrag.value) {
    didDrag.value = false
    return
  }

  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickY = event.clientY - rect.top

  // Hit test against stored targets
  for (const target of hitTargets.value) {
    if (
      clickX >= target.x &&
      clickX <= target.x + target.width &&
      clickY >= target.y &&
      clickY <= target.y + target.height
    ) {
      emit('select', target.index)
      return
    }
  }
}

// Handle scroll/zoom
const onWheel = (event: WheelEvent) => {
  event.preventDefault()

  if (event.ctrlKey || event.metaKey) {
    // Zoom
    const delta = event.deltaY > 0 ? 0.9 : 1.1
    scale.value = Math.max(0.5, Math.min(2, scale.value * delta))
    updateCanPan()
  } else if (canPan.value) {
    // Scroll vertically only
    offsetY.value += event.deltaY
    clampOffsets()
  }

  draw()
}

// Mouse drag handlers for vertical panning only
const onMouseDown = (event: MouseEvent) => {
  if (!canPan.value) return
  isDragging.value = true
  didDrag.value = false
  dragStartY.value = event.clientY
  dragStartOffsetY.value = offsetY.value
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'grabbing'
  }
}

const onMouseMove = (event: MouseEvent) => {
  // Handle dragging
  if (isDragging.value && canPan.value) {
    const deltaY = event.clientY - dragStartY.value
    // Mark as dragged if we moved more than a few pixels
    if (Math.abs(deltaY) > 3) {
      didDrag.value = true
    }
    offsetY.value = dragStartOffsetY.value - deltaY
    clampOffsets()
    draw()
    return
  }

  // Update cursor based on hit target
  updateCursor(event)
}

const updateCursor = (event: MouseEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  // Check if over a hit target
  const overTarget = hitTargets.value.some(target =>
    mouseX >= target.x &&
    mouseX <= target.x + target.width &&
    mouseY >= target.y &&
    mouseY <= target.y + target.height
  )

  if (overTarget) {
    canvas.style.cursor = 'pointer'
  } else if (canPan.value) {
    canvas.style.cursor = 'grab'
  } else {
    canvas.style.cursor = 'default'
  }
}

const onMouseUp = () => {
  isDragging.value = false
  if (canvasRef.value) {
    canvasRef.value.style.cursor = canPan.value ? 'grab' : 'default'
  }
}

// Check if content is larger than viewport
const updateCanPan = () => {
  const container = containerRef.value
  if (!container) {
    canPan.value = false
    return
  }

  const contentHeight = (nodes.value.length * (nodeHeight + nodeGap) - nodeGap) * scale.value
  const availableHeight = container.clientHeight - nodePadding * 2
  canPan.value = contentHeight > availableHeight
}

// Clamp offsets to reasonable bounds
const clampOffsets = () => {
  const container = containerRef.value
  if (!container) return

  const contentHeight = (nodes.value.length * (nodeHeight + nodeGap) - nodeGap) * scale.value
  const maxOffsetY = Math.max(0, contentHeight - container.clientHeight + nodePadding * 2)
  offsetY.value = Math.max(0, Math.min(maxOffsetY, offsetY.value))
}

// Check if run is in progress
const isRunning = computed(() => {
  return props.run?.status === 'running'
})

// Start/stop pulse animation
const startPulseAnimation = () => {
  if (pulseInterval) return
  pulseInterval = setInterval(() => {
    pulsePhase.value += 0.15
    draw()
  }, 50)
}

const stopPulseAnimation = () => {
  if (pulseInterval) {
    clearInterval(pulseInterval)
    pulseInterval = null
  }
}

// Handle resize
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  // Initial draw
  nextTick(() => draw())

  // Watch for changes
  watch(() => [props.run, props.selectedIndex, props.agent], () => {
    nextTick(() => draw())
  }, { deep: true })

  // Watch for running state to start/stop animation
  watch(isRunning, (running) => {
    if (running) {
      startPulseAnimation()
    } else {
      stopPulseAnimation()
    }
  }, { immediate: true })

  // Resize observer (check if ResizeObserver is available for test environments)
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      draw()
    })
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  stopPulseAnimation()
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// Expose nodes for parent component
defineExpose({
  nodes,
})

</script>

<style scoped>

.execution-flow {
  width: 100%;
  height: 100%;
  overflow: hidden;

  canvas {
    display: block;
  }
}

</style>
