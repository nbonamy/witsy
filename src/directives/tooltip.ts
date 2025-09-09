import { DirectiveBinding } from 'vue'
import '../../css/tooltip.css'
import { stat } from 'fs'

interface TooltipOptions {
  text: string
  position?: 'right' | 'left' | 'top' | 'top-left' | 'top-right' | 'bottom' | 'bottom-left' | 'bottom-right'
}

interface ElementTooltipState {
  options: TooltipOptions
  tooltipElement: HTMLElement | null
  hideTimeout: NodeJS.Timeout | null
  wrapper: HTMLElement | null
}

// WeakMap to store per-element state
const elementState = new WeakMap<HTMLElement, ElementTooltipState>()

let lastTooltipHidden = 0

const createTooltip = (text: string, position: string = 'right'): HTMLElement => {
  const tooltip = document.createElement('div')
  tooltip.className = `tooltip-directive ${position}`
  tooltip.textContent = text
  
  // Create arrow element
  const arrow = document.createElement('div')
  arrow.className = 'arrow'
  
  tooltip.appendChild(arrow)
  return tooltip
}


const calculateTooltipPosition = (el: HTMLElement, position: string = 'right') => {
  const rect = el.getBoundingClientRect()
  const scrollX = window.scrollX || document.documentElement.scrollLeft
  const scrollY = window.scrollY || document.documentElement.scrollTop
  
  const x = rect.left + scrollX
  const y = rect.top + scrollY
  const width = rect.width
  const height = rect.height
  
  const spacing = 8 // Gap between tooltip and target element
  
  switch (position) {
    case 'above':
      return { left: x + 'px', bottom: (window.innerHeight - y + spacing) + 'px' }
    case 'above-right':
      return { right: (window.innerWidth - x - width) + 'px', bottom: (window.innerHeight - y + spacing) + 'px' }
    case 'above-left':
      return { left: x + 'px', bottom: (window.innerHeight - y + spacing) + 'px' }
    case 'right':
      return { left: (x + width + spacing) + 'px', top: y + 'px' }
    case 'left':
      return { right: (window.innerWidth - x + spacing) + 'px', top: y + 'px' }
    case 'below-right':
      return { right: (window.innerWidth - x - width) + 'px', top: (y + height + spacing) + 'px' }
    case 'below-left':
      return { left: x + 'px', top: (y + height + spacing) + 'px' }
    case 'top':
      return { bottom: (window.innerHeight - y + spacing) + 'px', left: (x + width/2) + 'px', transform: 'translateX(-50%)' }
    case 'top-left':
      return { bottom: (window.innerHeight - y + spacing) + 'px', right: (window.innerWidth - x - width/2 - 15) + 'px' }
    case 'top-right':
      return { bottom: (window.innerHeight - y + spacing) + 'px', left: (x + width/2 - 5) + 'px' }
    case 'bottom':
      return { top: (y + height + spacing) + 'px', left: (x + width/2) + 'px', transform: 'translateX(-50%)' }
    case 'bottom-left':
      return { top: (y + height + spacing) + 'px', right: (window.innerWidth - x - width/2 - 15) + 'px' }
    case 'bottom-right':
      return { top: (y + height + spacing) + 'px', left: (x + width/2 - 5) + 'px' }
    case 'below':
    default:
      return { left: x + 'px', top: (y + height + spacing) + 'px' }
  }
}

const showTooltip = (el: HTMLElement) => {
  const state = elementState.get(el)
  if (!state || !state.options.text) return
  
  // Create tooltip and teleport to body
  state.tooltipElement = createTooltip(state.options.text, state.options.position)
  document.body.appendChild(state.tooltipElement)
  
  // Calculate and apply position
  const position = calculateTooltipPosition(el, state.options.position)
  Object.assign(state.tooltipElement.style, position)
  
  // Trigger reflow and show
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  state.tooltipElement.offsetHeight
  state.tooltipElement.style.opacity = '1'
}

const hideTooltip = (el: HTMLElement) => {
  
  const state = elementState.get(el)
  if (!state) return
  
  if (state.tooltipElement) {
    state.tooltipElement.style.opacity = '0'
    setTimeout(() => {
      if (state.tooltipElement) {
        state.tooltipElement.remove()
        state.tooltipElement = null
      }
    }, 200)
  }
  if (state.hideTimeout) {
    clearTimeout(state.hideTimeout)
    state.hideTimeout = null
  }
  lastTooltipHidden = Date.now()
}

const parseBindingValue = (binding: DirectiveBinding): TooltipOptions => {
  return typeof binding.value === 'string' 
    ? { text: binding.value, position: 'right' } 
    : binding.value
}

export const vTooltip = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const options = parseBindingValue(binding)
    
    // Initialize element state
    elementState.set(el, {
      options,
      tooltipElement: null,
      hideTimeout: null,
      wrapper: null
    })
    
    const onMouseEnter = () => {
      const state = elementState.get(el)
      if (!state) return
      
      if (state.hideTimeout) {
        clearTimeout(state.hideTimeout)
      }

      const now = Date.now()
      const timeSinceLastHide = now - lastTooltipHidden
      const tooltipDelay = timeSinceLastHide < 1000 ? 250 : 1000
      // console.log('Tooltip delay:', timeSinceLastHide, tooltipDelay, 'ms')
      state.hideTimeout = setTimeout(() => showTooltip(el), tooltipDelay)
    }
    
    const onMouseLeave = () => hideTooltip(el)
    const onClick = () => {
      // Don't interfere with the original click event
      // Just hide the tooltip if it's visible
      const state = elementState.get(el)
      if (state?.hideTimeout) {
        clearTimeout(state.hideTimeout)
        state.hideTimeout = null
      }
      if (state?.tooltipElement) {
        hideTooltip(el)
      }
    }
    
    el.addEventListener('mouseenter', onMouseEnter)
    el.addEventListener('mouseleave', onMouseLeave)
    el.addEventListener('click', onClick)
  },
  
  updated(el: HTMLElement, binding: DirectiveBinding) {
    const state = elementState.get(el)
    if (!state) return
    
    const newOptions = parseBindingValue(binding)
    state.options = newOptions
    
    // Update tooltip text if it's currently visible
    if (state.tooltipElement) {
      state.tooltipElement.textContent = newOptions.text
    }
  },
  
  unmounted(el: HTMLElement) {
    const state = elementState.get(el)
    if (!state) return
    
    hideTooltip(el)
    elementState.delete(el)
  }
}