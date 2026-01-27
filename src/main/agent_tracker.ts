
import { RunningAgentRuns } from 'types/agents'
import { emitIpcEventToAll } from './windows'

// Track running agent runs: agentId -> RunningRunInfo[]
const runningRuns: RunningAgentRuns = {}

// Track AbortControllers for main-process-triggered runs: "agentId:runId" -> AbortController
const abortControllers: Record<string, AbortController> = {}

const makeAbortKey = (agentId: string, runId: string): string => `${agentId}:${runId}`

export const getRunningAgentRuns = (): RunningAgentRuns => {
  return runningRuns
}

export const addRunningRun = (agentId: string, runId: string, startTime: number): void => {
  if (!runningRuns[agentId]) {
    runningRuns[agentId] = []
  }
  // Avoid duplicates
  if (!runningRuns[agentId].find(r => r.runId === runId)) {
    runningRuns[agentId].push({ runId, startTime })
  }
  emitRunningState(agentId, runId)
}

export const removeRunningRun = (agentId: string, runId: string): void => {
  if (runningRuns[agentId]) {
    runningRuns[agentId] = runningRuns[agentId].filter(r => r.runId !== runId)
    if (runningRuns[agentId].length === 0) {
      delete runningRuns[agentId]
    }
  }
  // Clean up abort controller if exists
  delete abortControllers[makeAbortKey(agentId, runId)]
  emitRunningState(agentId, runId)
}

export const removeAllRunningRunsForAgent = (agentId: string): void => {
  // Clean up abort controllers for all runs of this agent
  const runs = runningRuns[agentId] || []
  for (const run of runs) {
    delete abortControllers[makeAbortKey(agentId, run.runId)]
  }
  delete runningRuns[agentId]
  emitRunningState(agentId, null)
}

// Register an AbortController for a main-process-triggered run
export const registerAbortController = (agentId: string, runId: string, controller: AbortController): void => {
  abortControllers[makeAbortKey(agentId, runId)] = controller
}

// Abort a run (returns true if found and aborted in main process)
export const abortRun = (agentId: string, runId: string): boolean => {
  const key = makeAbortKey(agentId, runId)
  const controller = abortControllers[key]
  if (controller) {
    controller.abort()
    delete abortControllers[key]
    return true
  }
  return false
}

// Emit running state update to all windows
const emitRunningState = (agentId: string, runId: string | null): void => {
  emitIpcEventToAll('agent-run-update', {
    agentId,
    runId,
    runningAgentRuns: getRunningAgentRuns()
  })
}
