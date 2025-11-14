import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { PythonShell } from 'python-shell'
import { runPython } from '../../../src/main/interpreter'

// Mock python-shell
vi.mock('python-shell', () => ({
  PythonShell: {
    runString: vi.fn()
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('runPython should execute Python code and return result', async () => {
  const mockResult = ['Hello, World!', '42']
  vi.mocked(PythonShell.runString).mockResolvedValue(mockResult)

  const code = 'print("Hello, World!")\nprint(42)'
  const result = await runPython(code)

  expect(result).toEqual(mockResult)
  expect(PythonShell.runString).toHaveBeenCalledWith(code)
})

test('runPython should handle empty code', async () => {
  const mockResult = []
  vi.mocked(PythonShell.runString).mockResolvedValue(mockResult)

  const code = ''
  const result = await runPython(code)

  expect(result).toEqual(mockResult)
  expect(PythonShell.runString).toHaveBeenCalledWith(code)
})

test('runPython should propagate errors from PythonShell', async () => {
  const error = new Error('Python execution failed')
  vi.mocked(PythonShell.runString).mockRejectedValue(error)

  const code = 'invalid python syntax'
  
  await expect(runPython(code)).rejects.toThrow('Python execution failed')
  expect(PythonShell.runString).toHaveBeenCalledWith(code)
})

test('runPython should handle complex Python code', async () => {
  const mockResult = ['3', '6', '9']
  vi.mocked(PythonShell.runString).mockResolvedValue(mockResult)

  const code = `
for i in range(1, 4):
    print(i * 3)
`
  const result = await runPython(code)

  expect(result).toEqual(mockResult)
  expect(PythonShell.runString).toHaveBeenCalledWith(code)
})
