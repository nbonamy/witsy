import fs from 'fs'
import path from 'path'
import { App } from 'electron'

export interface CodeExecutionData {
  schemas: Record<string, any>
}

export const codeExecutionFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'code_exec.json')
}

export const loadCodeExecutionData = (app: App): CodeExecutionData => {
  const filePath = codeExecutionFilePath(app)

  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[code_exec] Error loading code execution data:', error)
    }
    // Return empty data if file doesn't exist
    return { schemas: {} }
  }
}

export const saveCodeExecutionData = (app: App, data: CodeExecutionData): void => {
  const filePath = codeExecutionFilePath(app)

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('[code_exec] Error saving code execution data:', error)
    throw error
  }
}
