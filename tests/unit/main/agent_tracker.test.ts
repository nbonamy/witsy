import { vi, expect, test, beforeEach, describe } from 'vitest'
import {
  getRunningAgentRuns,
  addRunningRun,
  removeRunningRun,
  removeAllRunningRunsForAgent,
  registerAbortController,
  abortRun
} from '@main/agent_tracker'
import * as windowsModule from '@main/windows'

vi.mock('@main/windows', () => ({
  emitIpcEventToAll: vi.fn()
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Clear running state by removing all runs for test agents
  removeAllRunningRunsForAgent('agent-1')
  removeAllRunningRunsForAgent('agent-2')
})

describe('agent_tracker', () => {

  describe('getRunningAgentRuns', () => {
    test('returns empty object initially', () => {
      expect(getRunningAgentRuns()).toEqual({})
    })
  })

  describe('addRunningRun', () => {
    test('adds a running run for an agent', () => {
      addRunningRun('agent-1', 'run-1', 1000)

      const runs = getRunningAgentRuns()
      expect(runs['agent-1']).toEqual([{ runId: 'run-1', startTime: 1000 }])
    })

    test('adds multiple runs for the same agent', () => {
      addRunningRun('agent-1', 'run-1', 1000)
      addRunningRun('agent-1', 'run-2', 2000)

      const runs = getRunningAgentRuns()
      expect(runs['agent-1']).toHaveLength(2)
      expect(runs['agent-1']).toContainEqual({ runId: 'run-1', startTime: 1000 })
      expect(runs['agent-1']).toContainEqual({ runId: 'run-2', startTime: 2000 })
    })

    test('adds runs for different agents', () => {
      addRunningRun('agent-1', 'run-1', 1000)
      addRunningRun('agent-2', 'run-2', 2000)

      const runs = getRunningAgentRuns()
      expect(runs['agent-1']).toEqual([{ runId: 'run-1', startTime: 1000 }])
      expect(runs['agent-2']).toEqual([{ runId: 'run-2', startTime: 2000 }])
    })

    test('prevents duplicate run IDs', () => {
      addRunningRun('agent-1', 'run-1', 1000)
      addRunningRun('agent-1', 'run-1', 2000) // Same runId

      const runs = getRunningAgentRuns()
      expect(runs['agent-1']).toHaveLength(1)
      expect(runs['agent-1'][0].startTime).toBe(1000) // Original time preserved
    })

    test('emits IPC event', () => {
      addRunningRun('agent-1', 'run-1', 1000)

      expect(windowsModule.emitIpcEventToAll).toHaveBeenCalledWith('agent-run-update', {
        agentId: 'agent-1',
        runId: 'run-1',
        runningAgentRuns: expect.any(Object)
      })
    })
  })

  describe('removeRunningRun', () => {
    test('removes a specific run', () => {
      addRunningRun('agent-1', 'run-1', 1000)
      addRunningRun('agent-1', 'run-2', 2000)

      removeRunningRun('agent-1', 'run-1')

      const runs = getRunningAgentRuns()
      expect(runs['agent-1']).toEqual([{ runId: 'run-2', startTime: 2000 }])
    })

    test('removes agent key when no runs remain', () => {
      addRunningRun('agent-1', 'run-1', 1000)

      removeRunningRun('agent-1', 'run-1')

      const runs = getRunningAgentRuns()
      expect(runs['agent-1']).toBeUndefined()
    })

    test('handles removing non-existent run', () => {
      removeRunningRun('agent-1', 'non-existent')
      expect(getRunningAgentRuns()).toEqual({})
    })

    test('emits IPC event', () => {
      addRunningRun('agent-1', 'run-1', 1000)
      vi.clearAllMocks()

      removeRunningRun('agent-1', 'run-1')

      expect(windowsModule.emitIpcEventToAll).toHaveBeenCalledWith('agent-run-update', {
        agentId: 'agent-1',
        runId: 'run-1',
        runningAgentRuns: expect.any(Object)
      })
    })
  })

  describe('removeAllRunningRunsForAgent', () => {
    test('removes all runs for an agent', () => {
      addRunningRun('agent-1', 'run-1', 1000)
      addRunningRun('agent-1', 'run-2', 2000)
      addRunningRun('agent-2', 'run-3', 3000)

      removeAllRunningRunsForAgent('agent-1')

      const runs = getRunningAgentRuns()
      expect(runs['agent-1']).toBeUndefined()
      expect(runs['agent-2']).toEqual([{ runId: 'run-3', startTime: 3000 }])
    })

    test('emits IPC event with null runId', () => {
      addRunningRun('agent-1', 'run-1', 1000)
      vi.clearAllMocks()

      removeAllRunningRunsForAgent('agent-1')

      expect(windowsModule.emitIpcEventToAll).toHaveBeenCalledWith('agent-run-update', {
        agentId: 'agent-1',
        runId: null,
        runningAgentRuns: expect.any(Object)
      })
    })
  })

  describe('registerAbortController and abortRun', () => {
    test('abortRun returns false when no controller registered', () => {
      const result = abortRun('agent-1', 'run-1')
      expect(result).toBe(false)
    })

    test('abortRun aborts and returns true when controller registered', () => {
      const controller = new AbortController()
      const abortSpy = vi.spyOn(controller, 'abort')

      registerAbortController('agent-1', 'run-1', controller)
      const result = abortRun('agent-1', 'run-1')

      expect(result).toBe(true)
      expect(abortSpy).toHaveBeenCalled()
    })

    test('abortRun removes controller after abort', () => {
      const controller = new AbortController()
      registerAbortController('agent-1', 'run-1', controller)

      abortRun('agent-1', 'run-1')
      const result = abortRun('agent-1', 'run-1') // Second call

      expect(result).toBe(false) // Controller was removed
    })

    test('removeRunningRun also cleans up abort controller', () => {
      const controller = new AbortController()
      registerAbortController('agent-1', 'run-1', controller)
      addRunningRun('agent-1', 'run-1', 1000)

      removeRunningRun('agent-1', 'run-1')
      const result = abortRun('agent-1', 'run-1')

      expect(result).toBe(false) // Controller was cleaned up
    })

    test('removeAllRunningRunsForAgent cleans up all abort controllers', () => {
      const controller1 = new AbortController()
      const controller2 = new AbortController()
      registerAbortController('agent-1', 'run-1', controller1)
      registerAbortController('agent-1', 'run-2', controller2)
      addRunningRun('agent-1', 'run-1', 1000)
      addRunningRun('agent-1', 'run-2', 2000)

      removeAllRunningRunsForAgent('agent-1')

      expect(abortRun('agent-1', 'run-1')).toBe(false)
      expect(abortRun('agent-1', 'run-2')).toBe(false)
    })
  })

})
