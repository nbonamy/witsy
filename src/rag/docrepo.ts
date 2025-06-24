
import { App } from 'electron'
import { SourceType, DocumentBase, DocumentQueueItem, DocRepoQueryResponseItem } from 'types/rag'
import { notifyBrowserWindows } from '../main/window'
import { docrepoFilePath } from './utils'
import DocumentBaseImpl from './docbase'
import DocumentSourceImpl from './docsource'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'

export default class DocumentRepository {

  app: App
  activeDb: DocumentBaseImpl | null = null
  contents: DocumentBaseImpl[] = []
  queue: DocumentQueueItem[] = []
  processing = false

  constructor(app: App) {
    this.app = app
    this.activeDb = null
    this.processing = false
    this.queue = []
    this.load()
  }

  list(): DocumentBase[] {
    return this.contents.map((db) => {
      return {
        uuid: db.uuid,
        name: db.name,
        embeddingEngine: db.embeddingEngine,
        embeddingModel: db.embeddingModel,
        documents: db.documents.map((doc) => {
          return {
            uuid: doc.uuid,
            type: doc.type,
            title: doc.title,
            origin: doc.origin,
            filename: path.basename(doc.origin),
            url: doc.url,
            items: doc.items.map((item) => {
              return {
                uuid: item.uuid,
                type: item.type,
                title: item.title,
                origin: item.origin,
                filename: path.basename(item.origin),
                url: item.url,
              }
            })
          }
        })
      }
    })
  }

  queueLength(): number {
    return this.queue.length
  }

  async connect(baseId: string, replaceActive = false): Promise<DocumentBaseImpl> {

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
    await base.connect()

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
        const base = new DocumentBaseImpl(this.app, jsonDb.uuid, jsonDb.title, jsonDb.embeddingEngine, jsonDb.embeddingModel)
        for (const jsonDoc of jsonDb.documents) {
          const doc = new DocumentSourceImpl(jsonDoc.uuid, jsonDoc.type, jsonDoc.origin)
          base.documents.push(doc)
          for (const jsonItem of jsonDoc.items) {
            doc.items.push(new DocumentSourceImpl(jsonItem.uuid, jsonItem.type, jsonItem.origin))
          }
        }
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
      fs.writeFileSync(docrepoFile, JSON.stringify(this.contents.map((db) => {
        return {
          uuid: db.uuid,
          title: db.name,
          embeddingEngine: db.embeddingEngine,
          embeddingModel: db.embeddingModel,
          documents: db.documents
        }
      }), null, 2))

      // notify
      notifyBrowserWindows('docrepo-modified')
      
    } catch (error) {
      console.log('[rag] Error saving docrepo', error)
    }
  }

  async create(title: string, embeddingEngine: string, embeddingModel: string): Promise<string> {

    // now create the base
    const base = new DocumentBaseImpl(this.app, uuidv4(), title, embeddingEngine, embeddingModel)
    await base.create()
    this.contents.push(base)

    // log
    //console.log('[rag] Created document database', databasePath(this.app, id))

    // save and done
    this.save()
    this.activeDb = base
    return base.uuid
  
  }

  async rename(baseId: string, name: string): Promise<void> {

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

  async delete(baseId: string): Promise<void> {

    // check (we need the index anyway)
    const index = this.contents.findIndex(b => b.uuid == baseId)
    if (index === -1) {
      throw new Error('Database not found')
    }

    // connect and delete
    try {
      const base = await this.connect(baseId)
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

  async addDocument(baseId: string, type: SourceType, origin: string): Promise<string> {

    // connect
    const base = await this.connect(baseId)
    
    // check if it exists
    console.log('[rag] Adding document', origin)
    let document: DocumentSourceImpl = base.documents.find(d => d.origin == origin)
    if (!document) {
      document = new DocumentSourceImpl(uuidv4(), type, origin)
    }

    // add to queue
    this.queue.push({ uuid: document.uuid, baseId, type, origin })

    // process
    if (!this.processing) {
      this.processQueue()
    }

    // done
    return document.uuid

  }

  async processQueue(): Promise<void> {

    // set the flag
    this.processing = true

    // empty the queue
    while (this.queue.length > 0) {
    
      // get the first item
      const queueItem = this.queue[0]

      // get the base
      const base = await this.connect(queueItem.baseId)
      if (!base) {
        continue
      }

      // log
      console.log('[rag] Processing document', queueItem.origin)

      // add the document
      let error = null
      try {
        await base.add(queueItem.uuid, queueItem.type, queueItem.origin, () => this.save())
      } catch (e) {
        console.error('Error adding document', e)
        error = e
      }

      // now remove it from the queue
      this.queue.shift()

      // done
      this.save()
      
      // notify
      if (error) {
        notifyBrowserWindows('docrepo-add-document-error', {
          ...queueItem,
          error: error.message,
          queueLength: this.queueLength()
        })
      } else {
        notifyBrowserWindows('docrepo-add-document-done', {
          ...queueItem,
          queueLength: this.queueLength()
        })
      }

    }

    // done
    this.processing = false

  }

  async removeDocument(baseId: string, docId: string): Promise<void> {

    // get the base
    const base = await this.connect(baseId)

    // do it
    await base.delete(docId, () => this.save())

    // notify
    notifyBrowserWindows('docrepo-del-document-done')

    // done
    this.save()

  }

  async query(baseId: string, text: string): Promise<DocRepoQueryResponseItem[]> {

    // get the base
    const base = await this.connect(baseId, true)

    // query
    return await base.query(text)

  }

}
