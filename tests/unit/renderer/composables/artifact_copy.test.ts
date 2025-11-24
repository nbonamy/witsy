import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useArtifactCopy } from '@composables/artifact_copy'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

describe('useArtifactCopy', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  test('copying flag is initially false', () => {
    const { copying } = useArtifactCopy(() => 'test content')
    expect(copying.value).toBe(false)
  })

  test('onCopy sets copying flag to true', () => {
    const { copying, onCopy } = useArtifactCopy(() => 'test content')
    onCopy()
    expect(copying.value).toBe(true)
  })

  test('onCopy calls clipboard.writeText with content', () => {
    const contentGetter = vi.fn(() => 'my test content')
    const { onCopy } = useArtifactCopy(contentGetter)

    onCopy()
    expect(contentGetter).toHaveBeenCalled()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('my test content')
  })

  test('onCopy resets copying flag after 1 second', () => {
    const { copying, onCopy } = useArtifactCopy(() => 'test content')

    onCopy()
    expect(copying.value).toBe(true)

    // Advance timers by 1 second
    vi.advanceTimersByTime(1000)
    expect(copying.value).toBe(false)
  })

  test('onCopy resets copying flag after timeout even if called multiple times', () => {
    const { copying, onCopy } = useArtifactCopy(() => 'test content')

    onCopy()
    expect(copying.value).toBe(true)

    // Call again before timeout
    vi.advanceTimersByTime(500)
    onCopy()
    expect(copying.value).toBe(true)

    // First timeout should fire
    vi.advanceTimersByTime(500)
    expect(copying.value).toBe(false)

    // Second timeout should fire
    vi.advanceTimersByTime(500)
    expect(copying.value).toBe(false)
  })

})
