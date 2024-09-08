import { App } from 'electron'
import { Configuration } from '../types/config.d'
import { SourceType, DocumentBase, DocRepoQueryResponseItem } from '../types/rag.d'
import { notifyBrowserWindows } from '../main/window'
import VectorDB from './vectordb'
import Embedder from './embedder'
import Loader from './loader'
import Splitter from './splitter'
import * as config from '../main/config'
import * as file from '../main/file'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'

const docrepoFilePath = (app: App): string => {
  const userDataPath = app.getPath('userData')
  const commandsFilePath = path.join(userDataPath, 'docrepo.json')
  return commandsFilePath
}

const databasePath = (app: App, id: string): string => {
  const userDataPath = app.getPath('userData')
  const docRepoFolder = path.join(userDataPath, 'docrepo')
  const databasePath = path.join(docRepoFolder, id)
  return databasePath
}

export class DocumentSourceImpl {
  
  uuid: string
  title: string
  type: SourceType
  origin: string
  url: string
  items: DocumentSourceImpl[]

  constructor(id: string, type: SourceType, origin: string) {
    this.uuid = id
    this.type = type
    this.origin = origin
    if (this.type === 'file' || this.type === 'folder') {
      this.url = `file://${encodeURI(origin)}`
    } else {
      this.url = origin
    }
    this.title = this.getTitle()
    this.items = []
  }

  getTitle(): string {
    if (this.type === 'file') {
      return path.basename(decodeURI(this.url))
    } else if (this.title) {
      return this.title
    } else {
      return this.url
    }
  }
}

export class DocumentBaseImpl {
  
  app: App
  config: Configuration

  uuid: string
  name: string
  embeddingEngine: string
  embeddingModel: string
  documents: DocumentSourceImpl[]

  constructor(app: App, config: Configuration, uuid: string, name: string, embeddingEngine: string, embeddingModel: string) {
    this.app = app
    this.config = config
    this.uuid = uuid
    this.name = name
    this.embeddingEngine = embeddingEngine
    this.embeddingModel = embeddingModel
    this.documents = []
  }

  async add(uuid: string, type: SourceType, url: string, callback: Function): Promise<string> {

    // check existing
    let source = this.documents.find(d => d.uuid === uuid)
    if (source) {
      await this.delete(uuid)
    } else {
      source = new DocumentSourceImpl(uuid, type, url)
    }

    // add if
    if (type === 'folder') {

      // we add first so container is visible
      this.documents.push(source)
      await this.addFolder(source, callback)

    } else {

      // we add only when it's done
      await this.addFile(source, callback)
      this.documents.push(source)

    }

    // now store
    console.log(`Added document "${source.url}" to database "${this.name}"`)

    // done
    return source.uuid

  }

  async addFile(source: DocumentSourceImpl, callback?: Function): Promise<void> {

    // load the content
    const loader = new Loader(this.config)
    const text = await loader.load(source.type, source.origin)
    if (!text) {
      throw new Error('Unsupported document type')
    }

    // set title if web page
    if (source.type === 'url') {
      const titleMatch = text.match(/<title>(.*?)<\/title>/i)
      if (titleMatch && titleMatch[1]) {
        source.title = titleMatch[1].trim()
      }
    }

    // now split
    const splitter = new Splitter(this.config)
    const chunks = await splitter.split(text)

    // now embeds
    const documents = []
    const embedder = await Embedder.init(this.app, this.config, this.embeddingEngine, this.embeddingModel)
    for (const chunk of chunks) {
      const embedding = await embedder.embed(chunk)
      documents.push({
        content: chunk,
        vector: embedding,
      })
    }
    
    // debug
    //console.log('Documents:', documents)
    
    // now store each document
    const db = await VectorDB.connect(databasePath(this.app, this.uuid))
    for (const document of documents) {
      await db.insert(source.uuid, document.content, document.vector, {
        uuid: source.uuid,
        type: source.type,
        title: source.getTitle(),
        url: source.url
      })

    }

    // done
    callback?.()
    
  }

  async addFolder(source: DocumentSourceImpl, callback: Function): Promise<void> {

    // list files in folder recursively
    const files = file.listFilesRecursively(source.origin)
    for (const file of files) {
      try {
        console.log('Processing file', file)
        const doc = new DocumentSourceImpl(uuidv4(), 'file', file)
        await this.addFile(doc)
        source.items.push(doc)
        callback?.()
      } catch (error) {
        //console.error('Error adding file', file, error)
      }
    }
  
  }

  async delete(docId: string): Promise<void> {

    // find the document
    const index = this.documents.findIndex(d => d.uuid == docId)
    if (index === -1) {
      throw new Error('Document not found')
    }

    // list the database documents
    let docIds = [ docId ]
    const document = this.documents[index]
    if (document.items.length > 0) {
      docIds = document.items.map((item) => item.uuid)
    }

    // delete from the database
    const db = await VectorDB.connect(databasePath(this.app, this.uuid))
    for (const docId of docIds) {
      await db.delete(docId)
    }

    // remove it
    this.documents.splice(index, 1)

  }  

}

export interface DocumentQueueItem {
  uuid: string
  baseId: string
  type: SourceType
  origin: string
}

export default class DocumentRepository {

  app: App
  config: Configuration
  contents: DocumentBaseImpl[] = []
  queue: DocumentQueueItem[] = []
  processing: boolean = false

  constructor(app: App) {
    this.app = app
    this.config = config.loadSettings(app)
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

  load(): void {

    // clear
    this.contents = []

    const docrepoFile = docrepoFilePath(this.app)
    try {

      const repoJson = fs.readFileSync(docrepoFile, 'utf-8')
      for (const jsonDb of JSON.parse(repoJson)) {
        const base = new DocumentBaseImpl(this.app, this.config, jsonDb.uuid, jsonDb.title, jsonDb.embeddingEngine, jsonDb.embeddingModel)
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
        console.log('Error retrieving docrepo', error)
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
      console.log('Error saving docrepo', error)
    }
  }

  async create(title: string, embeddingEngine: string, embeddingModel: string): Promise<string> {

    // we need a new id
    const id = uuidv4()

    // create the database
    const dbPath = databasePath(this.app, id)
    fs.mkdirSync(dbPath, { recursive: true })
    await VectorDB.create(dbPath, Embedder.dimensions(embeddingEngine, embeddingModel))

    // log
    //console.log('Created document database', databasePath(this.app, id))

    // now create the base
    const base = new DocumentBaseImpl(this.app, this.config, id, title, embeddingEngine, embeddingModel)
    this.contents.push(base)

    // save and done
    this.save()
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

    // find in the list
    const index = this.contents.findIndex(b => b.uuid == baseId)
    if (index === -1) {
      throw new Error('Database not found')
    }

    // delete the database
    const dbPath = databasePath(this.app, baseId)
    fs.rmSync(dbPath, { recursive: true, force: true })

    // now remove from the list
    this.contents.splice(index, 1)

    // done
    this.save()

  }

  addDocument(baseId: string, type: SourceType, origin: string): string {

    // make sure the base is valid
    const base = this.contents.find(b => b.uuid == baseId)
    if (!base) {
      throw new Error('Database not found')
    }

    // check if it exists
    console.log('Adding document', origin)
    let existing: DocumentSourceImpl = base.documents.find(d => d.origin == origin)
    if (!existing) {
      existing = new DocumentSourceImpl(uuidv4(), type, origin)
    }

    // add to queue
    this.queue.push({ uuid: existing.uuid, baseId, type, origin })

    // process
    if (!this.processing) {
      this.processQueue()
    }

    // done
    return existing.uuid

  }

  async processQueue(): Promise<void> {

    // set the flag
    this.processing = true

    // empty the queue
    while (this.queue.length > 0) {
    
      // get the first item
      const queueItem = this.queue[0]

      // get the base
      const base = this.contents.find(b => b.uuid == queueItem.baseId)
      if (!base) continue

      // log
      console.log('Processing document', queueItem.origin)

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

    // find in the list
    const base = this.contents.find(b => b.uuid == baseId)
    if (!base) {
      throw new Error('Database not found')
    }

    // do it
    await base.delete(docId)

    // notify
    notifyBrowserWindows('docrepo-del-document-done')

    // done
    this.save()

  }

  async query(baseId: string, text: string): Promise<DocRepoQueryResponseItem[]> {

    // needed
    const searchResultCount = this.config.rag?.searchResultCount ?? 7

    // get the base
    const base = this.contents.find(b => b.uuid == baseId)
    if (!base) {
      throw new Error('Database not found')
    }

    // now embed
    const embedder = await Embedder.init(this.app, this.config, base.embeddingEngine, base.embeddingModel)
    const query = await embedder.embed(text)
    //console.log('query', query)

    // now query
    const db = await VectorDB.connect(databasePath(this.app, baseId))
    const results = await db.query(query, searchResultCount+10)
    //console.log('results', results)
    
    // done
    return results
      .map((result) => {
        return {
          content: result.item.metadata.content as string,
          score: result.score,
          metadata: result.item.metadata.metadata as any,
        };
      })
      .filter((result) => result.score > 0.0)
      .sort((a, b) => b.score - a.score)
      .slice(0, searchResultCount);

  }

}
