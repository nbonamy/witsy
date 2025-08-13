
import { App } from 'electron'
import { SourceType, DocumentQueueItem, DocRepoQueryResponseItem, DocRepoListener } from 'types/rag'
import { notifyBrowserWindows } from '../main/window'
import { docrepoFilePath } from './utils'
import DocumentBaseImpl from './docbase'
import DocumentSourceImpl from './docsource'
import fs from 'fs'
import { loadSettings } from '../main/config'
import { Configuration } from 'types/config'
import Loader from './loader'

export default class DocumentRepository {

  app: App
  activeDb: DocumentBaseImpl | null = null
  contents: DocumentBaseImpl[] = []
  queue: DocumentQueueItem[] = []
  processing = false
  listeners: DocRepoListener[] = []

  constructor(app: App) {
    this.app = app
    this.activeDb = null
    this.processing = false
    this.queue = []
    this.listeners = []
    this.load()
  }

  addListener(listener: DocRepoListener): void {
    this.listeners.push(listener)
  }

  removeListener(listener: DocRepoListener): void {
    const index = this.listeners.indexOf(listener)
    if (index !== -1) {
      this.listeners.splice(index, 1)
    }
  }

  private notifyDocumentAdded(docSource: DocumentSourceImpl): void {
    for (const listener of this.listeners) {
      listener.onDocumentSourceAdded(docSource)
    }
  }

  private notifyDocumentRemoved(origin: string): void {
    for (const listener of this.listeners) {
      listener.onDocumentSourceRemoved(origin)
    }
  }

  list(workspaceId: string): DocumentBaseImpl[] {
    return this.contents
      .filter(db => db.workspaceId === workspaceId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((db) => DocumentBaseImpl.fromJSON(this.app, db))
  }

  getCurrentQueueItem(): DocumentQueueItem | null {
    return this.queue.length > 0 ? this.queue[0] : null
  }

  queueLength(): number {
    return this.queue.length
  }

  async connect(baseId: string, replaceActive = false, connectToDb: boolean = true): Promise<DocumentBaseImpl> {

    // if already connected, do nothing
    if (this.activeDb && this.activeDb.uuid == baseId) {
      return this.activeDb
    }

    // check the base
    const base = this.contents.find(b => b.uuid == baseId)
    if (!base) {
      throw new Error('Database not found')
    }

    // connext
    if (connectToDb) {
      await base.connect()
    }

    // set it
    if (replaceActive) {
      this.activeDb = base
    }

    // done
    return base

  }

  async disconnect(): Promise<void> {
    if (this.activeDb) {
      this.activeDb = null
    }
  }

  load(): void {

    // clear
    this.contents = []

    // init
    const docrepoFile = docrepoFilePath(this.app)

    // load the file
    try {

      const repoJson = fs.readFileSync(docrepoFile, 'utf-8')
      for (const jsonDb of JSON.parse(repoJson)) {
        const base = DocumentBaseImpl.fromJSON(this.app, jsonDb)
        this.contents.push(base)
      }

    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.log('[rag] Error retrieving docrepo', error)
      }
    }

  }

  save(): void {
    try {

      // save the file
      const docrepoFile = docrepoFilePath(this.app)
      fs.writeFileSync(docrepoFile, JSON.stringify(this.contents.map((db: DocumentBaseImpl) => ({
        ...db,
        app: undefined,
        db: undefined,
      } as any)), null, 2))

      // notify
      notifyBrowserWindows('docrepo-modified')
      
    } catch (error) {
      console.log('[rag] Error saving docrepo', error)
    }
  }

  async createDocBase(workspaceId: string, title: string, embeddingEngine: string, embeddingModel: string): Promise<string> {

    // now create the base
    const base = new DocumentBaseImpl(this.app, crypto.randomUUID(), title, embeddingEngine, embeddingModel, workspaceId)
    await base.create()
    this.contents.push(base)

    // log
    //console.log('[rag] Created document database', databasePath(this.app, id))

    // save and done
    this.save()
    this.activeDb = base
    return base.uuid
  
  }

  async renameDocBase(baseId: string, name: string): Promise<void> {

    // get the base
    const base = this.contents.find(b => b.uuid == baseId)
    if (!base) {
      throw new Error('Database not found')
    }

    // rename
    base.name = name

    // done
    this.save()

  }

  async deleteDocBase(baseId: string): Promise<void> {

    // check (we need the index anyway)
    const index = this.contents.findIndex(b => b.uuid == baseId)
    if (index === -1) {
      throw new Error('Database not found')
    }

    // connect and delete
    try {
      const base = await this.connect(baseId, false, false)
      base.destroy()
    } catch (error: unknown) {
      if (!(error instanceof Error && error.message.includes('Index does not exist'))) {
        throw error;
      }
    }

    // update activeDb
    if (this.activeDb?.uuid == baseId) {
      this.activeDb = null
    }

    // now remove from the list
    this.contents.splice(index, 1)

    // done
    this.save()

  }

  async addDocumentSource(baseId: string, type: SourceType, origin: string, fromUserAction: boolean, title?: string): Promise<string> {

    // connect
    const base = await this.connect(baseId)
    
    // check if it exists
    console.log('[rag] Adding document', origin)
    let document: DocumentSourceImpl = base.documents.find(d => d.origin == origin)
    if (!document) {
      document = new DocumentSourceImpl(crypto.randomUUID(), type, origin, title)
    }

    // add to queue
    this.queue.push({ uuid: document.uuid, baseId, type, origin, title, operation: 'add', fromUserAction })

    // process
    this.processQueue()

    // done
    return document.uuid

  }

  async addChildDocumentSource(baseId: string, parentDocId: string, type: SourceType, origin: string, fromUserAction: boolean): Promise<string> {

    // connect
    const base = await this.connect(baseId)
    
    // find the parent document
    const parentDoc = base.documents.find(d => d.uuid === parentDocId)
    if (!parentDoc) {
      throw new Error('Parent document not found')
    }
    
    // check if child already exists
    console.log('[rag] Adding child document', origin, 'to parent', parentDoc.origin)
    let childDoc = parentDoc.items.find(item => item.origin === origin)
    if (!childDoc) {
      childDoc = new DocumentSourceImpl(crypto.randomUUID(), type, origin)
      // Don't add to parent's items yet - wait for successful processing
    }

    // add to queue (we still need to process the actual content)
    this.queue.push({ uuid: childDoc.uuid, baseId, type, origin, parentDocId, operation: 'add', fromUserAction })

    // process
    this.processQueue()

    // don't save yet - wait for successful processing

    // done
    return childDoc.uuid

  }

  async removeDocumentSource(baseId: string, sourceId: string): Promise<void> {

    // get the base
    const base = await this.connect(baseId)

    // first, try to find the document in top-level documents
    let docSource = base.documents.find(doc => doc.uuid === sourceId)
    let parentDocId: string | undefined

    // if not found in top-level, look for it as a child document
    if (!docSource) {
      for (const doc of base.documents) {
        if (doc.items) {
          docSource = doc.items.find(item => item.uuid === sourceId)
          if (docSource) {
            parentDocId = doc.uuid
            break
          }
        }
      }
    }

    if (!docSource) {
      console.warn('[rag] Document not found for removal:', sourceId)
      return
    }

    // add to queue for deletion
    this.queue.push({ 
      uuid: sourceId, 
      baseId, 
      type: docSource.type, 
      origin: docSource.origin, 
      parentDocId,
      operation: 'delete', 
      fromUserAction: true 
    })

    // process
    this.processQueue()

  }

  async removeChildDocumentSource(baseId: string, sourceId: string): Promise<void> {

    // get the base
    const base = await this.connect(baseId)

    // find the child document in any folder before queueing removal
    let docSource: DocumentSourceImpl | undefined
    let parentDocId: string | undefined
    for (const doc of base.documents) {
      if (doc.items) {
        docSource = doc.items.find(item => item.uuid === sourceId)
        if (docSource) {
          parentDocId = doc.uuid
          break
        }
      }
    }

    if (!docSource) {
      console.warn('[rag] Child document not found for removal:', sourceId)
      return
    }

    // add to queue for deletion
    this.queue.push({ 
      uuid: sourceId, 
      baseId, 
      type: docSource.type, 
      origin: docSource.origin, 
      parentDocId,
      operation: 'delete', 
      fromUserAction: true 
    })

    // process
    this.processQueue()

  }

  async updateDocumentSource(baseId: string, sourceId: string): Promise<void> {

    // get the base
    const base = await this.connect(baseId)

    // find the document before queueing update
    const docSource = base.documents.find(doc => doc.uuid === sourceId)
    if (!docSource) {
      console.warn('[rag] Document not found for update:', sourceId)
      return
    }

    // add to queue for update
    this.queue.push({ 
      uuid: sourceId, 
      baseId, 
      type: docSource.type, 
      origin: docSource.origin, 
      operation: 'update', 
      fromUserAction: true 
    })

    // process
    this.processQueue()

  }

  async updateChildDocumentSource(baseId: string, sourceId: string): Promise<void> {

    // get the base
    const base = await this.connect(baseId)

    // find the child document in any folder before queueing update
    let docSource: DocumentSourceImpl | undefined
    let parentDocId: string | undefined
    for (const doc of base.documents) {
      if (doc.items) {
        docSource = doc.items.find(item => item.uuid === sourceId)
        if (docSource) {
          parentDocId = doc.uuid
          break
        }
      }
    }

    if (!docSource) {
      console.warn('[rag] Child document not found for update:', sourceId)
      return
    }

    // add to queue for update
    this.queue.push({ 
      uuid: sourceId, 
      baseId, 
      type: docSource.type, 
      origin: docSource.origin, 
      parentDocId,
      operation: 'update', 
      fromUserAction: true 
    })

    // process
    this.processQueue()

  }

  async query(baseId: string, text: string): Promise<DocRepoQueryResponseItem[]> {

    // get the base
    const base = await this.connect(baseId, true)

    // query
    return await base.query(text)

  }

  getDocumentSource(baseId: string, docId: string): DocumentSourceImpl | null {

    // find the base
    const base = this.contents.find(b => b.uuid === baseId)
    if (!base) {
      return null
    }

    // search in top-level documents
    const topLevelDoc = base.documents.find(doc => doc.uuid === docId)
    if (topLevelDoc) {
      return topLevelDoc
    }

    // search in nested documents (folder items)
    for (const doc of base.documents) {
      if (doc.items && doc.items.length > 0) {
        const nestedDoc = doc.items.find(item => item.uuid === docId)
        if (nestedDoc) {
          return nestedDoc
        }
      }
    }

    // not found
    return null

  }

  isSourceSupported(type: SourceType, origin: string): boolean {
    try {
      const config: Configuration = loadSettings(this.app)
      const loader = new Loader(config)
      return loader.isParseable(type, origin)
    } catch (error) {
      console.error('[rag] Error checking if file is supported:', error)
      return false
    }
  }

  async scanForUpdates(callback?: () => void): Promise<void> {

    console.log('[rag] Starting offline change detection scan...')
    
    // Run asynchronously to avoid blocking app startup
    setImmediate(async () => {
      try {
        for (const base of this.contents) {
          try {

            // detect and process
            const changes = await base.scanForUpdates()
            await this.processUpdates(base, changes)

            // save if we had updates
            if (changes.added.length > 0 || changes.modified.length > 0 || changes.deleted.length > 0) {
              this.save()
            }

          } catch (error) {
            console.error(`[rag] Error scanning database ${base.name} for offline changes:`, error)
          }
        }
      } catch (error) {
        console.error('[rag] Error during offline change detection:', error)
      } finally {
        callback?.()
      }
    })
  }

  private async processUpdates(
    base: DocumentBaseImpl, 
    changes: {
      added: Array<{docSource: DocumentSourceImpl, parentFolder?: DocumentSourceImpl}>,
      modified: DocumentSourceImpl[],
      deleted: DocumentSourceImpl[]
    }
  ): Promise<void> {
    const { added, modified, deleted } = changes

    // Process deleted documents first
    for (const deletedDoc of deleted) {
      console.log(`[rag] Removing deleted document: ${deletedDoc.origin}`)
      
      try {
        if (deletedDoc.items && deletedDoc.items.length > 0) {
          // It's a folder, remove from root documents
          await base.deleteDocumentSource(deletedDoc.uuid)
        } else {
          // Check if it's a child item in a folder
          let isChildItem = false
          for (const rootDoc of base.documents) {
            if (rootDoc.type === 'folder' && rootDoc.items) {
              const itemIndex = rootDoc.items.findIndex(item => item.uuid === deletedDoc.uuid)
              if (itemIndex !== -1) {
                // Remove from folder items and database
                await base.deleteChildDocumentSource(deletedDoc.uuid)
                isChildItem = true
                break
              }
            }
          }
          
          if (!isChildItem) {
            // It's a root document
            await base.deleteDocumentSource(deletedDoc.uuid)
          }
        }
      } catch (error) {
        console.error(`[rag] Error removing deleted document ${deletedDoc.origin}:`, error)
      }
    }

    // Process modified documents
    for (const modifiedDoc of modified) {
      console.log(`[rag] Reprocessing modified document: ${modifiedDoc.origin}`)
      
      try {
        // Re-add the document to update its content in the database
        if (modifiedDoc.items && modifiedDoc.items.length > 0) {
          // It's a folder
          await base.addDocumentSource(modifiedDoc.uuid, modifiedDoc.type, modifiedDoc.origin, undefined, () => this.save())
        } else {
          // Check if it's a child item
          let isChildItem = false
          for (const rootDoc of base.documents) {
            if (rootDoc.type === 'folder' && rootDoc.items) {
              const childExists = rootDoc.items.some(item => item.uuid === modifiedDoc.uuid)
              if (childExists) {
                await base.processChildDocumentSource(modifiedDoc.uuid, modifiedDoc.type, modifiedDoc.origin, () => this.save())
                isChildItem = true
                break
              }
            }
          }
          
          if (!isChildItem) {
            // It's a root document
            await base.addDocumentSource(modifiedDoc.uuid, modifiedDoc.type, modifiedDoc.origin, undefined, () => this.save())
          }
        }
      } catch (error) {
        console.error(`[rag] Error reprocessing modified document ${modifiedDoc.origin}:`, error)
      }
    }

    // Process added documents
    for (const { docSource: addedDoc, parentFolder } of added) {
      console.log(`[rag] Adding new document: ${addedDoc.origin}`)
      
      try {
        if (parentFolder) {
          // Add as child to folder
          parentFolder.items.push(addedDoc)
          await base.processChildDocumentSource(addedDoc.uuid, addedDoc.type, addedDoc.origin, () => this.save())
        } else {
          // Add as root document
          base.documents.push(addedDoc)
          await base.addDocumentSource(addedDoc.uuid, addedDoc.type, addedDoc.origin, undefined, () => this.save())
        }
      } catch (error) {
        console.error(`[rag] Error adding new document ${addedDoc.origin}:`, error)
      }
    }
  }

  private async processQueue(): Promise<void> {
    
    // we are already processing
    if (this.processing) {
      return
    }

    // set the flag
    this.processing = true

    try {

      // empty the queue
      while (this.queue.length > 0) {
        const queueItem = this.queue[0]

        // get the base
        const base = await this.connect(queueItem.baseId)
        if (!base) {
          this.queue.shift()
          continue
        }

        // log
        console.log('[rag] Processing document', queueItem.operation, queueItem.origin)

        // process the document based on operation
        const error = await this.processQueueItem(queueItem, base)

        // remove item from queue and save
        this.queue.shift()
        this.save()
        
        // notify about the result
        this.notifyQueueItemResult(queueItem, error)
      
      }
    
    } catch (error) {
      console.error('[rag] Error processing document', error)
    }

    // done
    this.processing = false
  }

  private async processQueueItem(queueItem: DocumentQueueItem, base: DocumentBaseImpl): Promise<Error | null> {
    try {

      // 1st notify
      notifyBrowserWindows('docrepo-process-item-start', queueItem)

      // then process
      switch (queueItem.operation) {
        case 'add':
          await this.processAddOperation(queueItem, base)
          break
        case 'delete':
          await this.processDeleteOperation(queueItem, base)
          break
        case 'update':
          await this.processUpdateOperation(queueItem, base)
          break
      }
      return null
    } catch (e) {
      console.error(`Error ${queueItem.operation} document`, e)
      await this.handleOperationError(queueItem, base)
      return e as Error
    } finally {
      notifyBrowserWindows('docrepo-process-item-done', queueItem)
    }
  }

  private async processAddOperation(queueItem: DocumentQueueItem, base: DocumentBaseImpl): Promise<void> {
    if (queueItem.parentDocId) {
      // First, find and add the child to the parent's items if not already there
      const parentDoc = base.documents.find(d => d.uuid === queueItem.parentDocId)
      if (parentDoc) {
        const existingChild = parentDoc.items.find(item => item.uuid === queueItem.uuid)
        if (!existingChild) {
          const childDoc = new DocumentSourceImpl(queueItem.uuid, queueItem.type, queueItem.origin)
          parentDoc.items.push(childDoc)
        }
      }
      await base.processChildDocumentSource(queueItem.uuid, queueItem.type, queueItem.origin, () => this.save())
    } else {
      await base.addDocumentSource(queueItem.uuid, queueItem.type, queueItem.origin, queueItem.title, () => this.save())
    }
  }

  private async processDeleteOperation(queueItem: DocumentQueueItem, base: DocumentBaseImpl): Promise<void> {
    if (queueItem.parentDocId) {
      await base.deleteChildDocumentSource(queueItem.uuid, () => this.save())
      this.removeChildFromParent(queueItem, base)
    } else {
      await base.deleteDocumentSource(queueItem.uuid, () => this.save())
      this.removeDocumentFromBase(queueItem, base)
    }
  }

  private async processUpdateOperation(queueItem: DocumentQueueItem, base: DocumentBaseImpl): Promise<void> {
    // For updates, we essentially re-add the document
    if (queueItem.parentDocId) {
      await base.processChildDocumentSource(queueItem.uuid, queueItem.type, queueItem.origin, () => this.save())
    } else {
      await base.addDocumentSource(queueItem.uuid, queueItem.type, queueItem.origin, undefined, () => this.save())
    }
  }

  private async handleOperationError(queueItem: DocumentQueueItem, base: DocumentBaseImpl): Promise<void> {
    // If there was an error and it's a child document add operation, remove it from parent's items
    if (queueItem.operation === 'add' && queueItem.parentDocId) {
      this.removeChildFromParent(queueItem, base)
    }
    
    // If there was an error during delete operation, still clean up in-memory structures
    if (queueItem.operation === 'delete') {
      if (queueItem.parentDocId) {
        this.removeChildFromParent(queueItem, base)
      } else {
        this.removeDocumentFromBase(queueItem, base)
      }
    }
  }

  private removeChildFromParent(queueItem: DocumentQueueItem, base: DocumentBaseImpl): void {
    const parentDoc = base.documents.find(d => d.uuid === queueItem.parentDocId)
    if (parentDoc && parentDoc.items) {
      const childIndex = parentDoc.items.findIndex(item => item.uuid === queueItem.uuid)
      if (childIndex !== -1) {
        parentDoc.items.splice(childIndex, 1)
      }
    }
  }

  private removeDocumentFromBase(queueItem: DocumentQueueItem, base: DocumentBaseImpl): void {
    const docIndex = base.documents.findIndex(doc => doc.uuid === queueItem.uuid)
    if (docIndex !== -1) {
      base.documents.splice(docIndex, 1)
    }
  }

  private notifyQueueItemResult(queueItem: DocumentQueueItem, error: Error | null): void {
    
    if (error) {
      
      if (queueItem.fromUserAction) {
        const eventName = queueItem.operation === 'delete' ? 'docrepo-del-document-error' : 'docrepo-add-document-error'
        notifyBrowserWindows(eventName, {
          ...queueItem,
          error: error.message,
          queueLength: this.queueLength()
        })
      }
    
    } else {
    
      const eventName = queueItem.operation === 'delete' ? 'docrepo-del-document-done' : 'docrepo-add-document-done'
      notifyBrowserWindows(eventName, {
        ...queueItem,
        queueLength: this.queueLength()
      })
      
      // Notify listeners about document changes
      if (queueItem.operation === 'delete') {
        this.notifyDocumentRemoved(queueItem.origin)
      } else {
        const docSource = this.getDocumentSource(queueItem.baseId, queueItem.uuid)
        this.notifyDocumentAdded(docSource)
      }
    }
  }

}
