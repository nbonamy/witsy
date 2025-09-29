
import { store } from './store'

export const loadAgents = (): void => {
  try {
    store.agents = window.api.agents.load(store.config.workspaceId)
  } catch (error) {
    console.log('Error loading agents data', error)
  }
}
