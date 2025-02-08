import { onBeforeUnmount } from 'vue'
import mitt from 'mitt'

const eventEmitter = mitt()

export default function useEventBus () {
  const eventHandlers: { event: any; handler: any }[] = []

  onBeforeUnmount(() => 
    eventHandlers.forEach((eventHandler) => 
      eventEmitter.off(eventHandler.event, eventHandler.handler)
  ))

  return {
    onEvent: (event: string, handler: any) => {
      eventHandlers.push({ event, handler })
      eventEmitter.on(event, handler)
    },
    emitEvent: (event: any, payload?: unknown) => {
      eventEmitter.emit(event, payload)
    }
  }
}