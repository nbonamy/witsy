import mitt from 'mitt'
import { onBeforeUnmount } from 'vue'

/**
 * Bus signals for cross-branch/global communication only.
 *
 * IMPORTANT: Before adding a new signal, consider these alternatives:
 * - Vue emit/@event: For parent-child communication
 * - Provide/inject callbacks: For deep component hierarchies (see Chat.vue chat-callbacks pattern)
 *
 * Only use bus events when emitter and listener are in different branches
 * of the component tree (siblings across screens, global overlays, etc.)
 */
export type BusSignal =
  | 'audio-noise-detected'  // Global: Stop audio playback when noise detected (Prompt → *)
  | 'fullscreen'            // Global: Show media in fullscreen overlay (various → Fullscreen)
  | 'new-chat'              // Cross-screen: Create new chat (AudioBooth → Chat, Main)
  | 'set-main-window-mode'  // Cross-screen: Request main view change (AgentPicker, EmptyChat → Main)

const eventEmitter = mitt()

export default function useEventBus() {
  const eventHandlers: { event: BusSignal; handler: any }[] = []

  onBeforeUnmount(() =>
    eventHandlers.forEach((eventHandler) =>
      eventEmitter.off(eventHandler.event, eventHandler.handler)
  ))

  return {
    onBusEvent: (event: BusSignal, handler: any) => {
      eventHandlers.push({ event, handler })
      eventEmitter.on(event, handler)
    },
    emitBusEvent: (event: BusSignal, payload?: unknown) => {
      eventEmitter.emit(event, payload)
    }
  }
}