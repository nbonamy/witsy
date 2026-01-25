import { onBeforeUnmount } from 'vue'

type EventTarget = Window | Document | HTMLElement | MediaQueryList

export default function useEventListener() {
  const listeners: Array<{
    target: EventTarget
    event: string
    handler: EventListenerOrEventListenerObject
    options?: boolean | AddEventListenerOptions
  }> = []

  onBeforeUnmount(() => {
    listeners.forEach(({ target, event, handler, options }) => {
      target.removeEventListener(event, handler, options)
    })
  })

  return {
    onDomEvent: <T extends EventTarget>(
      target: T,
      event: string,
      handler: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => {
      listeners.push({ target, event, handler, options })
      target.addEventListener(event, handler, options)
    },
    offDomEvent: <T extends EventTarget>(
      target: T,
      event: string,
      handler: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => {
      const idx = listeners.findIndex(
        l => l.target === target && l.event === event && l.handler === handler
      )
      if (idx !== -1) {
        listeners.splice(idx, 1)
      }
      target.removeEventListener(event, handler, options)
    }
  }
}
