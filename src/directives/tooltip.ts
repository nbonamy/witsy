import { DirectiveBinding } from 'vue'
import '../../css/tooltip.css'

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

const getTooltipContainer = (el: HTMLElement): { container: HTMLElement, needsWrapper: boolean } => {
  // Check if element can have children (SVG elements cannot)
  const isSvg = el.tagName.toLowerCase() === 'svg' || el instanceof SVGElement
  const canHaveChildren = !isSvg && el.appendChild !== undefined
  
  if (canHaveChildren) {
    return { container: el, needsWrapper: false }
  }
  
  // Create wrapper for SVG or other elements that can't have children
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `
    position: relative;
    display: inline-block;
  `
  
  // Replace element with wrapper containing the element
  const parent = el.parentNode
  if (parent) {
    parent.insertBefore(wrapper, el)
    wrapper.appendChild(el)
  }
  
  return { container: wrapper, needsWrapper: true }
}

const showTooltip = (el: HTMLElement) => {
  const state = elementState.get(el)
  if (!state || !state.options.text) return
  
  const { container } = getTooltipContainer(el)
  
  state.tooltipElement = createTooltip(state.options.text, state.options.position)
  container.appendChild(state.tooltipElement)
  
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
    
    // Check if we need a wrapper and create it
    // console.log('vTooltip mounted', el, options)
    const { container, needsWrapper } = getTooltipContainer(el)
    
    // Initialize element state
    elementState.set(el, {
      options,
      tooltipElement: null,
      hideTimeout: null,
      wrapper: needsWrapper ? container : null
    })
    
    // Ensure container has relative positioning
    const currentPosition = getComputedStyle(container).position
    if (currentPosition === 'static') {
      container.style.position = 'relative'
    }
    
    const onMouseEnter = () => {
      const state = elementState.get(el)
      if (!state) return
      
      if (state.hideTimeout) {
        clearTimeout(state.hideTimeout)
      }

      const now = Date.now()
      const timeSinceLastHide = now - lastTooltipHidden
      const tooltipDelay = timeSinceLastHide < 1000 ? 250 : 750
      // console.log('Tooltip delay:', timeSinceLastHide, tooltipDelay, 'ms')
      state.hideTimeout = setTimeout(() => showTooltip(el), tooltipDelay)
    }
    
    const onMouseLeave = () => hideTooltip(el)
    const onClick = () => {
      // Don't interfere with the original click event
      // Just hide the tooltip if it's visible
      const state = elementState.get(el)
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
    
    // Clean up wrapper if we created one
    if (state.wrapper) {
      const parent = state.wrapper.parentNode
      if (parent) {
        parent.insertBefore(el, state.wrapper)
        state.wrapper.remove()
      }
    }
    
    elementState.delete(el)
  }
}