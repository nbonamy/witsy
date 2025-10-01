
import { WorkspaceHeader, Workspace } from '../types/workspace'
import { App } from 'electron'
import { agentsDirPath } from './agents'
import { docrepoFilePath } from '../rag/utils'
import { attachmentsFilePath, historyFilePath } from './history'
import { notifyBrowserWindows } from './windows'
import WorkspaceModel from '../models/workspace'
import path from 'path'
import fs from 'fs'

export const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000'

export const workspacesFolder = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const workspacesFolderPath = path.join(userDataPath, 'workspaces')
  fs.mkdirSync(workspacesFolderPath, { recursive: true })
  return workspacesFolderPath
}

export const workspaceFolderPath = (app: App, workspaceId: string): string => {
  const workspacesFolderPath = workspacesFolder(app)
  const workspaceFolderPath = path.join(workspacesFolderPath, workspaceId)
  fs.mkdirSync(workspaceFolderPath, { recursive: true })
  return workspaceFolderPath
}

export const listWorkspaces = (app: App): WorkspaceHeader[] => {
  const workspacesFolderPath = workspacesFolder(app)
  
  try {
    const folders = fs.readdirSync(workspacesFolderPath, { withFileTypes: true })
    const workspaces: WorkspaceHeader[] = []
    
    for (const folder of folders) {
      if (folder.isDirectory()) {
        const workspaceJsonPath = path.join(workspacesFolderPath, folder.name, 'workspace.json')
        
        try {
          const workspaceData = fs.readFileSync(workspaceJsonPath, 'utf8')
          const workspaceObj = JSON.parse(workspaceData)
          const workspace = WorkspaceModel.fromJson(workspaceObj)
          workspaces.push(workspace)
        } catch {
          // Skip folders without valid workspace.json files
          continue
        }
      }
    }
    
    return workspaces
  } catch {
    // If workspaces folder doesn't exist, return empty array
    return []
  }
}

export const loadWorkspace = (app: App, workspaceId: string): Workspace | null => {
  const workspacesFolderPath = workspacesFolder(app)
  const workspaceJsonPath = path.join(workspacesFolderPath, workspaceId, 'workspace.json')
  
  try {
    const workspaceData = fs.readFileSync(workspaceJsonPath, 'utf8')
    const workspaceObj = JSON.parse(workspaceData)
    return WorkspaceModel.fromJson(workspaceObj)
  } catch {
    return null
  }
}

export const saveWorkspace = (app: App, workspace: Workspace): boolean => {
  const workspacesFolderPath = workspacesFolder(app)
  const workspaceFolderPath = path.join(workspacesFolderPath, workspace.uuid)
  const workspaceJsonPath = path.join(workspaceFolderPath, 'workspace.json')
  
  try {
    fs.mkdirSync(workspaceFolderPath, { recursive: true })
    fs.writeFileSync(workspaceJsonPath, JSON.stringify(workspace, null, 2))
    notifyBrowserWindows('workspaces-updated')
    return true
  } catch {
    return false
  }
}

export const deleteWorkspace = (app: App, workspaceId: string): boolean => {
  const workspacesFolderPath = workspacesFolder(app)
  const workspaceFolderPath = path.join(workspacesFolderPath, workspaceId)
  
  try {
    fs.rmSync(workspaceFolderPath, { recursive: true, force: true })
    notifyBrowserWindows('workspaces-updated')
    return true
  } catch {
    return false
  }
}

export const initializeWorkspace = (app: App, workspaceId: string): void => {


  // check if it exists first
  const workspaceExists = listWorkspaces(app).some(ws => ws.uuid === workspaceId)
  if (workspaceExists) return

  // create the workspace folder and the workspace definition file
  workspaceFolderPath(app, workspaceId)
  saveWorkspace(app, {
    uuid: workspaceId,
    name: 'Workspace',
  })

  // if it is not the default one there is not much else we can do
  if (workspaceId !== DEFAULT_WORKSPACE_ID) return

  // otherwise we can migrate legacy stuff
  migrateExistingItemsToWorkspace(app, workspaceId);

}

export const migrateHistoryImagePaths = (history: string, workspaceId: string, platform: string = process.platform): string => {
  if (platform === 'win32') {
    const r = /file:\/\/(.*?)(\\*)Witsy(\\*)images(\\*)(.*?)/g
    return history.replaceAll(r, `file://$1$3Witsy$3workspaces${'$3'}${workspaceId}$3images$3$5`)
  } else {
    const r = /file:\/\/(.*)\/Witsy\/images\/(.*?)/g
    return history.replaceAll(r, `file://$1/Witsy/workspaces/${workspaceId}/images/$2`)
  }
}

export const migrateExistingItemsToWorkspace = (app: App, workspaceId: string): boolean => {

  const userDataPath = app.getPath('userData')
  const itemsToMigrate = [
    { src: path.join(userDataPath, 'agents'), dest: agentsDirPath(app, workspaceId) },
    { src: path.join(userDataPath, 'images'), dest: attachmentsFilePath(app, workspaceId) },
    { src: path.join(userDataPath, 'history.json'), dest: historyFilePath(app, workspaceId) }
  ]

  let migrationOccurred = false

  try {
    for (const item of itemsToMigrate) {
      if (fs.existsSync(item.src) && !fs.existsSync(item.dest)) {
        try {
          fs.renameSync(item.src, item.dest)
          migrationOccurred = true
          console.log(`Migrated ${item.src} to workspace ${workspaceId}`)
        } catch (error) {
          console.error(`Failed to migrate ${item.src}:`, error)
          // Continue with other items even if one fails
        }
      }
    }

    // now we need to add the workspace to all existing docrepo
    let index = 0;
    const docRepoFile = docrepoFilePath(app)
    if (fs.existsSync(docRepoFile)) {
      const docRepos = JSON.parse(fs.readFileSync(docRepoFile, 'utf8'))
      for (const docRepo of docRepos) {
        docRepo.workspaceId = workspaceId
        if (!docRepo.name || !docRepo.name.length) {
          docRepo.name = `Collection ${++index}`
        }
      }
      fs.writeFileSync(docRepoFile, JSON.stringify(docRepos, null, 2))
    }

    // now we need to migrate images url in history.json
    const historyFile = historyFilePath(app, workspaceId)
    if (fs.existsSync(historyFile)) {
      try {
        const history = fs.readFileSync(historyFile, 'utf8')
        const migratedHistory = migrateHistoryImagePaths(history, workspaceId)
        fs.writeFileSync(historyFile, migratedHistory)
      } catch (error) {
        console.error(`Failed to migrate history.json for workspace ${workspaceId}:`, error)
      }
    }

    saveWorkspace(app, {
      uuid: workspaceId,
      name: 'MyWorkspace',
      icon: 'BIconBox',
      color: '#006edb'
    })
    
    return migrationOccurred
  } catch (error) {
    console.error('Migration failed:', error)
    return false
  }
}
