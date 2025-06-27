
import { PythonShell } from 'python-shell'

export const runPython = async (code: string): Promise<any> => {
  const result = await PythonShell.runString(code);
  return result
}
