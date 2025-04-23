
import { Agent } from 'types/index'
import { App } from 'electron'
import path from 'path'
import fs from 'fs'

export const agentsDirPath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const agentsDirPath = path.join(userDataPath, 'agents')
  return agentsDirPath
}

export const loadAgents = (source: App|string): Agent[] => {

  // init
  const agents: Agent[] = []
  const agentsDir = typeof source === 'string' ? source : agentsDirPath(source)

  // iterate over all files
  try {
    const files = fs.readdirSync(agentsDir)
    for (const file of files) {
      const filePath = path.join(agentsDir, file)
      if (fs.statSync(filePath).isFile()) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          agents.push(JSON.parse(content))
        }
        catch (error) {
          console.log('Error reading agent file', filePath, error)
          continue
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log('Error retrieving agents', error)
    }
  }

  // done
  return agents

}
