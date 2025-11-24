import { WebApp } from 'types/workspace'
import { ref } from 'vue'
import { store } from '@services/store'

export default function useWebappManager() {
  const loadedWebapps = ref<WebApp[]>([])
  let evictionInterval: NodeJS.Timeout | null = null

  const loadWebapp = (webappId: string) => {
    // Check if already loaded
    if (loadedWebapps.value.find(w => w.id === webappId)) {
      return
    }

    // Find webapp in workspace
    const webapp = store.workspace.webapps?.find(w => w.id === webappId && w.enabled)
    if (!webapp) {
      console.warn(`[webapp-manager] Webapp ${webappId} not found or disabled`)
      return
    }

    // Add to loaded webapps
    loadedWebapps.value.push({
      ...webapp,
      lastUsed: Date.now()
    })

    // console.log(`[webapp-manager] Loaded webapp: ${webappId}`)
  }

  const updateLastUsed = (webappId: string) => {
    const webapp = loadedWebapps.value.find(w => w.id === webappId)
    if (webapp) {
      webapp.lastUsed = Date.now()

      // Also update in workspace
      const workspaceWebapp = store.workspace.webapps?.find(w => w.id === webappId)
      if (workspaceWebapp) {
        workspaceWebapp.lastUsed = Date.now()
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onNavigate = (webappId: string, url: string) => {
    // console.log(`[webapp-manager] Webapp ${webappId} navigated to: ${url}`)
  }

  const setupEviction = () => {
    const evictionMinutes = store.config.general.webappEvictionMinutes || 30
    const evictionMs = evictionMinutes * 60 * 1000

    // Check for eviction every minute
    evictionInterval = setInterval(() => {
      const now = Date.now()
      const toEvict: string[] = []

      loadedWebapps.value.forEach(webapp => {
        if (webapp.lastUsed && (now - webapp.lastUsed) > evictionMs) {
          toEvict.push(webapp.id)
        }
      })

      if (toEvict.length > 0) {
        console.log(`[webapp-manager] Evicting ${toEvict.length} webapp(s):`, toEvict)
        loadedWebapps.value = loadedWebapps.value.filter(w => !toEvict.includes(w.id))
      }
    }, 60000) // Check every minute
  }

  const cleanup = () => {
    if (evictionInterval) {
      clearInterval(evictionInterval)
      evictionInterval = null
    }
  }

  return {
    loadedWebapps,
    loadWebapp,
    updateLastUsed,
    onNavigate,
    setupEviction,
    cleanup
  }
}
