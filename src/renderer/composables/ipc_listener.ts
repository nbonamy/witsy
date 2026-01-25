import { onBeforeUnmount } from 'vue'

type IpcCallback = (value: any) => void

export default function useIpcListener() {
  const handlers: Array<{ signal: string; id: string }> = []

  onBeforeUnmount(() => {
    handlers.forEach(({ signal, id }) => {
      window.api._off(signal, id)
    })
  })

  return {
    onIpcEvent: (signal: string, callback: IpcCallback): string => {
      const id = window.api._on(signal, callback)
      handlers.push({ signal, id })
      return id
    },
    offIpcEvent: (signal: string, id: string) => {
      const idx = handlers.findIndex(h => h.signal === signal && h.id === id)
      if (idx !== -1) {
        handlers.splice(idx, 1)
      }
      window.api._off(signal, id)
    }
  }
}
