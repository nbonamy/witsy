import { App } from 'electron'
import { SourceType, DocRepoListener } from '../types/rag'
import DocumentRepository from './docrepo'
import DocumentSourceImpl from './docsource'
import { watch, FSWatcher } from 'chokidar'
import path from 'path'
import fs from 'fs'

interface PendingOperation {
  path: string
  operation: 'add' | 'change' | 'unlink'
  timer: NodeJS.Timeout
}

export default class DocumentMonitor implements DocRepoListener {

  app: App
  docRepo: DocumentRepository
  watchers: Map<string, FSWatcher> = new Map()
  pendingOperations: Map<string, PendingOperation> = new Map()
  debounceDelay: number = 1000 // 1 second debounce

  constructor(app: App, docRepo: DocumentRepository) {
    this.app = app
    this.docRepo = docRepo
  }

  start(): void {
    console.log('[docmonitor] Starting document monitor')
    this.setupWatchers()
    
    // Register as listener with docRepo
    this.docRepo.addListener(this)
  }

  stop(): void {
    console.log('[docmonitor] Stopping document monitor')
    
    // Unregister from docRepo
    this.docRepo.removeListener(this)
    
    // Clear all pending operations
    for (const pending of this.pendingOperations.values()) {
      clearTimeout(pending.timer)
    }
    this.pendingOperations.clear()

    // Close all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
  }

  private setupWatchers(): void {
    // Monitor all existing DocSources across all docbases
    for (const docBase of this.docRepo.contents) {
      for (const docSource of docBase.documents) {
        this.addDocSourceWatcher(docSource)
      }
    }
  }

  // DocRepoListener interface implementation
  onDocumentSourceAdded(baseId: string, docId: string, type: SourceType, origin: string): void {
    console.log(`[docmonitor] Document added notification: ${origin}`)
    const docSource = new DocumentSourceImpl(docId, type, origin)
    this.addDocSourceWatcher(docSource)
  }

  onDocumentSourceRemoved(baseId: string, docId: string, origin: string): void {
    console.log(`[docmonitor] Document removed notification: ${origin}`)
    // Remove the watcher for this document
    const watcher = this.watchers.get(origin)
    if (watcher) {
      console.log(`[docmonitor] Removing watcher for: ${origin}`)
      watcher.close()
      this.watchers.delete(origin)
    }
    
    // Clear any pending operations for this path
    this.clearPendingOperation(origin)
  }

  private addDocSourceWatcher(docSource: DocumentSourceImpl): void {
    const watchPath = docSource.origin
    
    // Skip if already watching this path
    if (this.watchers.has(watchPath)) {
      return
    }

    // Only watch 'file' and 'folder' types
    if (docSource.type !== 'file' && docSource.type !== 'folder') {
      return
    }

    // Check if path exists
    if (!fs.existsSync(watchPath)) {
      console.warn(`[docmonitor] Path does not exist: ${watchPath}`)
      return
    }

    console.log(`[docmonitor] Adding watcher for ${docSource.type}: ${watchPath}`)

    try {
      const watchOptions = {
        ignored: /(^|[/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true, // don't trigger on initial scan
        followSymlinks: false,
        depth: docSource.type === 'folder' ? undefined : 0, // recursive for folders, just the file for files
      }

      const watcher = watch(watchPath, watchOptions)

      watcher
        .on('add', (filePath: string) => {
          console.log(`[docmonitor] File added: ${filePath}`)
          this.handleFileEvent(filePath, 'add')
        })
        .on('change', (filePath: string) => {
          console.log(`[docmonitor] File changed: ${filePath}`)
          this.handleFileEvent(filePath, 'change')
        })
        .on('unlink', (filePath: string) => {
          console.log(`[docmonitor] File removed: ${filePath}`)
          this.handleFileEvent(filePath, 'unlink')
        })
        .on('unlinkDir', (dirPath: string) => {
          console.log(`[docmonitor] Directory removed: ${dirPath}`)
          this.handleDirectoryEvent(dirPath, 'unlinkDir')
        })
        .on('error', (error: Error) => {
          console.error(`[docmonitor] Watcher error for ${watchPath}:`, error)
        })

      this.watchers.set(watchPath, watcher)

    } catch (error) {
      console.error(`[docmonitor] Failed to create watcher for ${watchPath}:`, error)
    }
  }

  private removeDocSourceWatcher(docSource: DocumentSourceImpl): void {
    const watchPath = docSource.origin
    const watcher = this.watchers.get(watchPath)
    
    if (watcher) {
      console.log(`[docmonitor] Removing watcher for: ${watchPath}`)
      watcher.close()
      this.watchers.delete(watchPath)
    }

    // Clear any pending operations for this path
    this.clearPendingOperation(watchPath)
  }

  private handleFileEvent(filePath: string, operation: 'add' | 'change' | 'unlink'): void {
    // Cancel any existing pending operation for this file
    this.clearPendingOperation(filePath)

    // Use longer delay for add operations to allow filesystem to settle after moves
    const delay = operation === 'add' ? this.debounceDelay * 1.5 : this.debounceDelay

    // Create new debounced operation
    const timer = setTimeout(() => {
      this.processFileEvent(filePath, operation)
      this.pendingOperations.delete(filePath)
    }, delay)

    this.pendingOperations.set(filePath, {
      path: filePath,
      operation,
      timer
    })
  }

  private handleDirectoryEvent(dirPath: string, operation: 'unlinkDir'): void {
    // Cancel any existing pending operation for this directory
    this.clearPendingOperation(dirPath)

    // Create debounced operation for directory events
    const timer = setTimeout(() => {
      this.processDirectoryEvent(dirPath, operation)
      this.pendingOperations.delete(dirPath)
    }, this.debounceDelay)

    this.pendingOperations.set(dirPath, {
      path: dirPath,
      operation: 'unlink', // Reuse 'unlink' operation type for consistency
      timer
    })
  }

  private clearPendingOperation(filePath: string): void {
    const pending = this.pendingOperations.get(filePath)
    if (pending) {
      clearTimeout(pending.timer)
      this.pendingOperations.delete(filePath)
    }
  }

  private async processFileEvent(filePath: string, operation: 'add' | 'change' | 'unlink'): Promise<void> {
    try {
      console.log(`[docmonitor] Processing ${operation} for: ${filePath}`)

      // Find all docbases that contain this file or its parent folder
      const affectedDocBases = this.findAffectedDocBases(filePath)

      if (affectedDocBases.length === 0) {
        console.log(`[docmonitor] No affected docbases found for: ${filePath}`)
        return
      }

      for (const { docBase, docSource } of affectedDocBases) {
        switch (operation) {
          case 'add':
            // For new files, add them to the docbase
            if (docSource.type === 'folder' && fs.existsSync(filePath)) {
              console.log(`[docmonitor] Adding new file to docbase ${docBase.name}: ${filePath}`)
              await this.docRepo.addChildDocumentSource(docBase.uuid, docSource.uuid, 'file', filePath, false)
              await this.cleanupDuplicateDocuments(docBase, filePath)
            }
            break

          case 'change':
            // For changed files, update them in the docbase
            if (fs.existsSync(filePath)) {
              console.log(`[docmonitor] Updating file in docbase ${docBase.name}: ${filePath}`)
              
              // Find the specific document source for this file
              let targetDocSource = docSource
              if (docSource.type === 'folder') {
                targetDocSource = docSource.items.find(item => item.origin === filePath)
              }

              if (targetDocSource) {
                // Re-add the document (this will update it)
                if (docSource.type === 'folder') {
                  // If the parent is a folder, add as child document
                  await this.docRepo.addChildDocumentSource(docBase.uuid, docSource.uuid, targetDocSource.type, targetDocSource.origin, false)
                } else {
                  // If it's a root-level document, use addDocumentSource
                  await this.docRepo.addDocumentSource(docBase.uuid, targetDocSource.type, targetDocSource.origin, false)
                }
              }
            }
            break

          case 'unlink': {
            // For deleted files, remove them from the docbase
            console.log(`[docmonitor] Removing file from docbase ${docBase.name}: ${filePath}`)
            
            // Check if this is a root-level document that matches the file path
            if (docSource.type !== 'folder' && docSource.origin === filePath) {
              // The main document was deleted (root-level document)
              console.log(`[docmonitor] Removing root document: ${filePath}`)
              await this.docRepo.removeDocumentSource(docBase.uuid, docSource.uuid)
            }
            
            // Check if this is a child document in a folder
            if (docSource.type === 'folder') {
              // Look for the file in the folder's items
              const docToRemove = docSource.items.find(item => item.origin === filePath)
              if (docToRemove) {
                // Remove as child document from folder
                console.log(`[docmonitor] Removing child document from folder: ${filePath}`)
                await this.docRepo.removeChildDocumentSource(docBase.uuid, docToRemove.uuid)
              }
            }
            break
          }
        }
      }

    } catch (error) {
      console.error(`[docmonitor] Error processing ${operation} for ${filePath}:`, error)
    }
  }

  private async processDirectoryEvent(dirPath: string, operation: 'unlinkDir'): Promise<void> {
    try {
      console.log(`[docmonitor] Processing ${operation} for directory: ${dirPath}`)

      // Find all docbases that have this directory as a document source
      const affectedDocBases = this.findAffectedDocBasesForDirectory(dirPath)

      if (affectedDocBases.length === 0) {
        console.log(`[docmonitor] No affected docbases found for directory: ${dirPath}`)
        return
      }

      for (const { docBase, docSource } of affectedDocBases) {
        if (operation === 'unlinkDir') {
          // Check if this is a root-level folder document that matches or is within the directory path
          if (docSource.type === 'folder') {
            if (docSource.origin === dirPath) {
              // The main folder document was deleted
              console.log(`[docmonitor] Removing folder document source: ${dirPath}`)
              await this.docRepo.removeDocumentSource(docBase.uuid, docSource.uuid)
            } else {
              // This is a subdirectory that was affected by the parent directory deletion
              const relativePath = path.relative(dirPath, docSource.origin)
              if (!relativePath.startsWith('..') && relativePath !== '') {
                console.log(`[docmonitor] Removing subdirectory document source: ${docSource.origin}`)
                await this.docRepo.removeDocumentSource(docBase.uuid, docSource.uuid)
              }
            }
          }
        }
      }

    } catch (error) {
      console.error(`[docmonitor] Error processing ${operation} for directory ${dirPath}:`, error)
    }
  }

  private findAffectedDocBases(filePath: string): Array<{ docBase: any, docSource: DocumentSourceImpl }> {
    const affected: Array<{ docBase: any, docSource: DocumentSourceImpl }> = []

    for (const docBase of this.docRepo.contents) {
      for (const docSource of docBase.documents) {
        if (this.isFileAffectedByDocSource(filePath, docSource)) {
          affected.push({ docBase, docSource })
        }
      }
    }

    return affected
  }

  private findAffectedDocBasesForDirectory(dirPath: string): Array<{ docBase: any, docSource: DocumentSourceImpl }> {
    const affected: Array<{ docBase: any, docSource: DocumentSourceImpl }> = []

    for (const docBase of this.docRepo.contents) {
      for (const docSource of docBase.documents) {
        if (this.isDirectoryAffectedByDocSource(dirPath, docSource)) {
          affected.push({ docBase, docSource })
        }
      }
    }

    return affected
  }

  private isFileAffectedByDocSource(filePath: string, docSource: DocumentSourceImpl): boolean {
    // Direct file match (only for file type, not folder type)
    if (docSource.type !== 'folder' && docSource.origin === filePath) {
      return true
    }

    // For folders, check if the file is within the folder (but not the folder itself)
    if (docSource.type === 'folder') {
      const relativePath = path.relative(docSource.origin, filePath)
      return !relativePath.startsWith('..') && relativePath !== ''
    }

    // Check sub-items for folder-type documents
    if (docSource.items && docSource.items.length > 0) {
      return docSource.items.some(item => item.origin === filePath)
    }

    return false
  }

  private isDirectoryAffectedByDocSource(dirPath: string, docSource: DocumentSourceImpl): boolean {
    // Direct folder match - check if this document source is for the deleted directory
    if (docSource.type === 'folder' && docSource.origin === dirPath) {
      return true
    }

    // Check if this document source is a subdirectory of the deleted directory
    if (docSource.type === 'folder') {
      const relativePath = path.relative(dirPath, docSource.origin)
      // If the relative path doesn't start with '..', then docSource.origin is within dirPath
      return !relativePath.startsWith('..') && relativePath !== ''
    }

    return false
  }

  private async cleanupDuplicateDocuments(docBase: any, filePath: string): Promise<void> {
    try {
      // Look for root-level documents that have the same file path as a child in a folder
      const rootDuplicates: DocumentSourceImpl[] = []
      
      // Find all root documents that match this file path
      for (const rootDoc of docBase.documents) {
        if (rootDoc.type !== 'folder' && rootDoc.origin === filePath) {
          rootDuplicates.push(rootDoc)
        }
      }

      // Find if this file exists as a child in any folder
      let existsInFolder = false
      for (const folderDoc of docBase.documents) {
        if (folderDoc.type === 'folder' && folderDoc.items) {
          const childExists = folderDoc.items.some((item: DocumentSourceImpl) => item.origin === filePath)
          if (childExists) {
            existsInFolder = true
            break
          }
        }
      }

      // If the file exists in a folder and also as root documents, remove the root duplicates
      if (existsInFolder && rootDuplicates.length > 0) {
        console.log(`[docmonitor] Cleaning up ${rootDuplicates.length} duplicate root documents for: ${filePath}`)
        
        for (const duplicate of rootDuplicates) {
          console.log(`[docmonitor] Removing duplicate root document: ${duplicate.origin}`)
          await this.docRepo.removeDocumentSource(docBase.uuid, duplicate.uuid)
        }
      }
    } catch (error) {
      console.error(`[docmonitor] Error cleaning up duplicates for ${filePath}:`, error)
    }
  }
}