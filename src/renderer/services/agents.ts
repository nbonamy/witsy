
import { store } from './store'

export const loadAgents = (): void => {
  try {
    store.agents = window.api.agents.list(store.config.workspaceId)
  } catch (error) {
    console.log('Error loading agents data', error)
  }
}

// Local abort controllers for renderer-triggered runs: "agentId:runId" -> AbortController
const abortControllers = new Map<string, AbortController>()

const makeAbortKey = (agentId: string, runId: string): string => `${agentId}:${runId}`

// Register an AbortController for a renderer-triggered run
export const registerAbortController = (agentId: string, runId: string, controller: AbortController): void => {
  abortControllers.set(makeAbortKey(agentId, runId), controller)
}

// Unregister an AbortController (e.g., when run completes)
export const unregisterAbortController = (agentId: string, runId: string): void => {
  abortControllers.delete(makeAbortKey(agentId, runId))
}

// Abort a run: try local first, then IPC to main process
export const abortRun = (agentId: string, runId: string): boolean => {
  const key = makeAbortKey(agentId, runId)
  const controller = abortControllers.get(key)

  if (controller) {
    // Local renderer-triggered run
    controller.abort()
    abortControllers.delete(key)
    return true
  }

  // Try main process (webhook/schedule triggered run)
  return window.api.agents.abortRun(agentId, runId)
}
