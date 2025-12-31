// Input event bus for decoupled component communication

export type InputEventType = 'keydown' | 'keyup' | 'input-cleared'

export type InputEvent = {
  type: InputEventType
  key: string        // key pressed (e.g., '?', 'a', 'ENTER', 'ESCAPE')
  text: string       // current input text (before key on keydown, after on keyup)
}

// Global constants
export const DOUBLE_ESCAPE_DELAY = 1000

// Handler returns true to consume the event (prevent default behavior)
type InputEventHandler = (event: InputEvent) => boolean | void

class InputEventBus {
  private handlers = new Set<InputEventHandler>()

  subscribe(handler: InputEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  // Returns true if any handler consumed the event
  emit(event: InputEvent): boolean {
    for (const handler of this.handlers) {
      if (handler(event) === true) {
        return true // consumed
      }
    }
    return false // not consumed
  }
}

export const inputEvents = new InputEventBus()
