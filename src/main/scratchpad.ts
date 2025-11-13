
import { App } from 'electron'
import { workspaceFolderPath } from './workspace'
import { ScratchpadHeader, ScratchpadData } from 'types/index'
import path from 'path'
import fs from 'fs'

export const scratchpadsFolderPath = (app: App, workspaceId: string): string => {
  const workspacePath = workspaceFolderPath(app, workspaceId)
  const scratchpadsPath = path.join(workspacePath, 'scratchpads')
  fs.mkdirSync(scratchpadsPath, { recursive: true })
  return scratchpadsPath
}

export const listScratchpads = (app: App, workspaceId: string): ScratchpadHeader[] => {
  const folderPath = scratchpadsFolderPath(app, workspaceId)

  try {
    const files = fs.readdirSync(folderPath)
      .filter(file => file.endsWith('.json'))

    const scratchpads: ScratchpadHeader[] = []

    for (const file of files) {
      try {
        const filePath = path.join(folderPath, file)
        const content = fs.readFileSync(filePath, 'utf8')
        const data: ScratchpadData = JSON.parse(content)

        scratchpads.push({
          uuid: data.uuid,
          title: data.title,
          lastModified: data.lastModified
        })
      } catch (err) {
        console.error(`Error reading scratchpad ${file}:`, err)
      }
    }

    // Sort by lastModified DESC (most recent first)
    return scratchpads.sort((a, b) => b.lastModified - a.lastModified)

  } catch (err) {
    console.error('Error listing scratchpads:', err)
    return []
  }
}

export const loadScratchpad = (app: App, workspaceId: string, uuid: string): ScratchpadData | null => {
  const folderPath = scratchpadsFolderPath(app, workspaceId)
  const filePath = path.join(folderPath, `${uuid}.json`)

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(content)
  } catch (err) {
    console.error(`Error loading scratchpad ${uuid}:`, err)
    return null
  }
}

export const saveScratchpad = (app: App, workspaceId: string, data: ScratchpadData): boolean => {
  const folderPath = scratchpadsFolderPath(app, workspaceId)
  const filePath = path.join(folderPath, `${data.uuid}.json`)

  try {
    // Update lastModified
    data.lastModified = Date.now()

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
    return true
  } catch (err) {
    console.error(`Error saving scratchpad ${data.uuid}:`, err)
    return false
  }
}

export const renameScratchpad = (app: App, workspaceId: string, uuid: string, newTitle: string): boolean => {
  const data = loadScratchpad(app, workspaceId, uuid)
  if (!data) return false

  data.title = newTitle
  data.lastModified = Date.now()

  return saveScratchpad(app, workspaceId, data)
}

export const deleteScratchpad = (app: App, workspaceId: string, uuid: string): boolean => {
  const folderPath = scratchpadsFolderPath(app, workspaceId)
  const filePath = path.join(folderPath, `${uuid}.json`)

  try {
    fs.unlinkSync(filePath)
    return true
  } catch (err) {
    console.error(`Error deleting scratchpad ${uuid}:`, err)
    return false
  }
}

export const importScratchpad = (app: App, workspaceId: string, filePath: string, title: string): string | null => {
  try {
    // Handle file:// URIs
    if (filePath.startsWith('file://')) {
      filePath = filePath.slice(7)
    }

    // Read external file
    const content = fs.readFileSync(filePath, 'utf8')
    const externalData = JSON.parse(content)

    // Create new scratchpad data with fresh metadata
    const uuid = crypto.randomUUID()
    const now = Date.now()

    // Determine contents - if it's a scratchpad file it will have contents property
    // Otherwise use the whole data as contents
    let contents = externalData.contents
    if (!contents) {
      // If no contents property, check if it's a simple object that can be used as contents
      if (externalData.content !== undefined) {
        contents = { content: externalData.content, start: 0, end: 0 }
      } else if (typeof externalData === 'string') {
        contents = { content: externalData, start: 0, end: 0 }
      } else {
        contents = { content: '', start: 0, end: 0 }
      }
    }

    const data: ScratchpadData = {
      uuid,
      title,
      contents,
      chat: externalData.chat || null,
      createdAt: now,
      lastModified: now
    }
    // Note: undo/redo stacks are session-only, not imported

    // Save to workspace
    if (saveScratchpad(app, workspaceId, data)) {
      return uuid
    }
    return null

  } catch (err) {
    console.error('Error importing scratchpad:', err)
    return null
  }
}
