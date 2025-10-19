
import { App } from 'electron'
import { Configuration } from '../types/config'
import { SourceType, DocRepoQueryResponseItem } from '../types/rag'
import defaultSettings from '../../defaults/settings.json'
import DocumentSourceImpl from './docsource'
import { loadSettings } from '../main/config'
import VectorDB from './vectordb'
import Embedder from './embedder'
import Loader from './loader'
import Splitter from './splitter'
import { databasePath } from './utils'
import * as file from '../main/file'
import fs from 'fs'

const ADD_COMMIT_EVERY = 5
const DELETE_COMMIT_EVERY = 10
const EMBED_BATCH_SIZE = 20

export default class DocumentBaseImpl {

  app: App
  db: VectorDB

  uuid: string
  name: string
  description?: string
  embeddingEngine: string
  embeddingModel: string
  workspaceId: string
  documents: DocumentSourceImpl[]

  constructor(app: App, uuid: string, name: string, embeddingEngine: string, embeddingModel: string, workspaceId: string, description?: string) {
    this.app = app
    this.uuid = uuid
    this.name = name
    this.description = description
    this.embeddingEngine = embeddingEngine
    this.embeddingModel = embeddingModel
    this.workspaceId = workspaceId
    this.documents = []
  }

  static fromJSON(app: App, json: any): DocumentBaseImpl {
    const base = new DocumentBaseImpl(app, json.uuid, json.name || json.title, json.embeddingEngine, json.embeddingModel, json.workspaceId, json.description)
    for (const doc of json.documents) {
      const source = DocumentSourceImpl.fromJSON(doc)
      base.documents.push(source)
    }
    return base
  }

  async create() {
    const dbPath = databasePath(this.app, this.uuid)
    fs.mkdirSync(dbPath, { recursive: true })
    await VectorDB.create(dbPath)
  }

  async connect(): Promise<void> {
    if (!this.db) {
      this.db = await VectorDB.connect(databasePath(this.app, this.uuid))
      console.log('[rag] Connected to database', this.name)
    }
  }

  async destroy(): Promise<void> {
    try {
      const dbPath = databasePath(this.app, this.uuid)
      fs.rmSync(dbPath, { recursive: true, force: true })
    } catch (err) {
      console.warn('[rag] Error deleting database', this.name, err)
    }
  }

  async addDocumentSource(uuid: string, type: SourceType, url: string, title?: string, callback?: VoidFunction): Promise<string|null> {

    // check existing
    let source = this.documents.find(d => d.uuid === uuid)
    if (source) {
      await this.deleteDocumentSource(uuid)
    } else {
      source = new DocumentSourceImpl(uuid, type, url, title)
    }

    // add if
    if (type === 'folder') {

      // we add first so container is visible
      this.documents.push(source)
      callback?.()
      await this.addFolder(source, callback)

    } else if (type === 'sitemap') {

      // we add first so container is visible
      this.documents.push(source)
      callback?.()
      await this.addSitemap(source, callback)

    } else {

      // we add first so container is visible
      this.documents.push(source)
      callback?.()

      // we add only when it's done
      try {
        await this.addDocument(source, callback)
      } catch (error) {
        console.error('[rag] Error adding document', error)
        this.documents = this.documents.filter(d => d.uuid !== source.uuid)
        callback?.()
        return null
      }

    }

    // now store
    console.log(`[rag] Added document "${source.url}" to database "${this.name}"`)

    // done
    return source.uuid

  }

  async processChildDocumentSource(uuid: string, type: SourceType, url: string, callback: VoidFunction): Promise<string> {

    // find existing child document in any folder
    let source: DocumentSourceImpl | undefined
    for (const parentDoc of this.documents) {
      if (parentDoc.items) {
        source = parentDoc.items.find(item => item.uuid === uuid)
        if (source) break
      }
    }

    if (!source) {
      throw new Error('Child document not found in any folder')
    }

    // only process the content - don't add to root documents array
    await this.addDocument(source, callback)

    // log
    console.log(`[rag] Processed child document "${source.url}" in database "${this.name}"`)

    // done
    return source.uuid

  }

  async addDocument(source: DocumentSourceImpl, callback?: VoidFunction): Promise<void> {

    // make sure we are connected
    await this.connect()

    // needed
    const config: Configuration = loadSettings(this.app)
    const loader = new Loader(config)
    if (!loader.isParseable(source.type, source.origin)) {
      throw new Error('[rag] Unsupported document type')
    }

    // log
    console.log(`[rag] Extracting text from [${source.type}] ${source.origin}`)

    // load the content
    const text = await loader.load(source.type, source.origin)
    if (!text) {
      console.log('[rag] Unable to load document', source.origin)
      throw new Error('Unable to load document')
    }

    // check the size
    const maxDocumentSizeMB = config.rag?.maxDocumentSizeMB ?? defaultSettings.rag.maxDocumentSizeMB
    if (text.length > maxDocumentSizeMB * 1024 * 1024) {
      console.log(`[rag] Document is too large (max ${maxDocumentSizeMB}MB)`, source.origin)
      throw new Error(`Document is too large (max ${maxDocumentSizeMB}MB)`)
    }

    // set title if web page
    if (source.type === 'url') {
      const titleMatch = text.match(/<title>(.*?)<\/title>/i)
      if (titleMatch && titleMatch[1]) {
        source.title = titleMatch[1].trim()
      }
    }

    // now split
    console.log(`[rag] Splitting document into chunks`)
    const splitter = new Splitter(config)
    const chunks = await splitter.split(text)

    // loose estimate of the batch size based on:
    // 1 token = 4 bytes
    // max tokens = 8192 (apply a 75% contingency)
    const batchSize = Math.min(EMBED_BATCH_SIZE, Math.floor(8192.0 * .75 / (splitter.chunkSize / 4.0)))
    const batchCount = Math.ceil(chunks.length / batchSize)
    const logInterval = Math.max(1, Math.floor(batchCount / 10))
    console.log(`[rag] Embedding ${chunks.length} chunks into ${batchCount} batches`)

    // we manage transactions for performance
    let transactionSize = 0
    await this.db.beginTransaction()

    // now embed and store
    let batchIndex = 0
    const embedder = await Embedder.init(this.app, config, this.embeddingEngine, this.embeddingModel)
    while (chunks.length > 0) {
      
      // log
      if (++batchIndex % logInterval === 0) {
        console.log(`[rag] Embedding batch ${batchIndex} of ${batchCount} (${chunks.length} chunks left)`)
      }

      // embed
      const batch = chunks.splice(0, batchSize)
      const embeddings = await embedder.embed(batch)
      //console.log('Embeddings', JSON.stringify(embeddings, null, 2))

      // store each embedding as a document
      for (let i = 0; i < batch.length; i++) {
        await this.db.insert(source.uuid, batch[i], embeddings[i], {
          uuid: source.uuid,
          type: source.type,
          title: source.title,
          url: source.url
        })
        if (++transactionSize === 1000) {
          await this.db.commitTransaction()
          await this.db.beginTransaction()
          transactionSize = 0
        }
      }
    }

    // finalize
    await this.db.commitTransaction()

    // Update metadata after successful processing (for file system sources only)
    if (source.type === 'file' || source.type === 'folder') {
      try {
        const stats = fs.statSync(source.origin)
        source.lastModified = stats.mtime.getTime()
        source.fileSize = stats.size
      } catch {
        // File might have been deleted during processing
      }
    }

    // done
    callback?.()

  }

  private async addChildDocuments(
    source: DocumentSourceImpl,
    childItems: Array<{ type: SourceType, origin: string }>,
    callback: VoidFunction
  ): Promise<void> {
    await this.connect()

    let added = 0
    for (const item of childItems) {
      try {
        const doc = new DocumentSourceImpl(crypto.randomUUID(), item.type, item.origin)
        await this.addDocument(doc)
        source.items.push(doc)

        if ((++added) % ADD_COMMIT_EVERY === 0) {
          callback?.()
        }
      } catch (error) {
        console.error('Error adding child document', item.origin, error)
      }
    }
    callback?.()
  }

  async addFolder(source: DocumentSourceImpl, callback: VoidFunction): Promise<void> {
    const files = file.listFilesRecursively(source.origin)
    const items = files.map(f => ({ type: 'file' as SourceType, origin: f }))
    await this.addChildDocuments(source, items, callback)
  }

  async addSitemap(source: DocumentSourceImpl, callback: VoidFunction): Promise<void> {
    const config: Configuration = loadSettings(this.app)
    const loader = new Loader(config)
    const urls = await loader.getSitemapUrls(source.origin)
    const items = urls.map(url => ({ type: 'url' as SourceType, origin: url }))
    await this.addChildDocuments(source, items, callback)
  }

  async deleteDocumentSource(docId: string, callback?: VoidFunction): Promise<void> {

    // find the document
    const index = this.documents.findIndex(d => d.uuid == docId)
    if (index === -1) {
      throw new Error('Document not found')
    }

    // list the database documents
    let docIds = [docId]
    const document = this.documents[index]
    if (document.items.length > 0) {
      docIds = document.items.map((item) => item.uuid)
    }

    // delete from the database using transaction
    await this.connect()
    await this.db.beginTransaction()

    // iterate
    let deleted = 0
    for (const docId of docIds) {

      // delete
      await this.db.delete(docId)

      // remove from doc list
      if (document.items.length > 0) {
        const index2 = document.items.findIndex(d => d.uuid == docId)
        if (index2 !== -1) {
          document.items.splice(index2, 1)

          // commit?
          if ((++deleted) % DELETE_COMMIT_EVERY === 0) {
            await this.db.commitTransaction()
            callback?.()
            await this.db.beginTransaction()
          }
        }
      }
    }

    // remove the main document
    this.documents.splice(index, 1)

    // done
    await this.db.commitTransaction()
    callback?.()

  }

  async deleteChildDocumentSource(docId: string, callback?: VoidFunction): Promise<void> {

    // find the child document in any folder
    let parentDoc: DocumentSourceImpl | undefined
    let childIndex = -1
    
    for (const doc of this.documents) {
      if (doc.items) {
        childIndex = doc.items.findIndex(item => item.uuid === docId)
        if (childIndex !== -1) {
          parentDoc = doc
          break
        }
      }
    }

    if (!parentDoc || childIndex === -1) {
      throw new Error('Child document not found in any folder')
    }

    // delete from the database
    await this.connect()
    await this.db.beginTransaction()
    await this.db.delete(docId)
    await this.db.commitTransaction()

    // remove from parent's items array
    parentDoc.items.splice(childIndex, 1)

    // done
    callback?.()

  }

  async query(text: string): Promise<DocRepoQueryResponseItem[]> {

    // needed
    const config: Configuration = loadSettings(this.app)
    const searchResultCount = config.rag?.searchResultCount ?? defaultSettings.rag.searchResultCount
    const relevanceCutOff = config.rag?.relevanceCutOff ?? defaultSettings.rag.relevanceCutOff

    // now embed
    const embedder = await Embedder.init(this.app, config, this.embeddingEngine, this.embeddingModel)
    const query = await embedder.embed([text])
    //console.log('query', query)

    // now query
    await this.connect()
    const results = await this.db.query(text, query[0], searchResultCount + 10)

    // filter and transform
    const filtered = results
      .filter((result) => result.score > relevanceCutOff)
      .map((result) => {
        return {
          content: result.item.metadata.content as string,
          score: result.score,
          metadata: result.item.metadata.metadata as any,
        }
      })
      //.sort((a, b) => b.score - a.score)
      .slice(0, searchResultCount)

    // log
    //console.log('results', JSON.stringify(filtered, null, 2))

    // done
    return filtered

  }

  /**
   * Scan all documents for changes that occurred while the app was offline
   * Returns arrays of documents that were added, modified, or deleted
   */
  async scanForUpdates(): Promise<{
    added: Array<{docSource: DocumentSourceImpl, parentFolder?: DocumentSourceImpl}>,
    modified: DocumentSourceImpl[],
    deleted: DocumentSourceImpl[]
  }> {
    // console.log(`[rag] Scanning for offline changes in database "${this.name}"`)
    
    const added: Array<{docSource: DocumentSourceImpl, parentFolder?: DocumentSourceImpl}> = []
    const modified: DocumentSourceImpl[] = []
    const deleted: DocumentSourceImpl[] = []

    // Scan root documents and their items
    for (const document of this.documents) {
      await this.scanDocumentForChanges(document, added, modified, deleted)
    }

    if (added.length > 0 || modified.length > 0 || deleted.length > 0) {
      console.log(`[rag] Offline scan complete: ${added.length} added, ${modified.length} modified, ${deleted.length} deleted`)
    }
    
    return { added, modified, deleted }
  }

  private async scanDocumentForChanges(
    document: DocumentSourceImpl,
    added: Array<{docSource: DocumentSourceImpl, parentFolder?: DocumentSourceImpl}>,
    modified: DocumentSourceImpl[],
    deleted: DocumentSourceImpl[]
  ): Promise<void> {
    
    if (!document.exists()) {
      deleted.push(document)
      return
    }

    if (document.type === 'file') {
      if (document.hasChanged()) {
        modified.push(document)
      }
    } else if (document.type === 'folder') {
      await this.scanFolderForNewFiles(document, added)
      for (const item of document.items) {
        await this.scanDocumentForChanges(item, added, modified, deleted)
      }
    }
  }

  private async scanFolderForNewFiles(
    folderDocument: DocumentSourceImpl,
    added: Array<{docSource: DocumentSourceImpl, parentFolder?: DocumentSourceImpl}>
  ): Promise<void> {
    if (folderDocument.type !== 'folder') return

    try {
      // Get all files in the folder recursively
      const existingPaths = new Set(folderDocument.items.map(item => item.origin))
      const files = file.listFilesRecursively(folderDocument.origin)

      for (const filePath of files) {
        if (!existingPaths.has(filePath)) {
          // Found a new file that wasn't tracked before
          const newDocSource = new DocumentSourceImpl(crypto.randomUUID(), 'file', filePath)
          
          added.push({
            docSource: newDocSource,
            parentFolder: folderDocument
          })
        }
      }
    } catch (error) {
      console.error(`[rag] Error scanning folder ${folderDocument.origin}:`, error)
    }
  }

}
