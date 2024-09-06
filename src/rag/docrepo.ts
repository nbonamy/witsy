import { App } from 'electron'
import { Configuration } from '../types/config.d'
import { SourceType, DocumentBase, DocRepoQueryResponseItem } from '../types/rag.d'
import { notifyBrowserWindows } from '../main/window'
import Embedder from './embedder'
import Loader from './loader'
import Splitter from './splitter'
import * as lancedb from '@lancedb/lancedb'
import * as config from '../main/config'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'

const DB_TABLE_NAME = 'vectors'

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

  constructor(id: string, type: SourceType, origin: string) {
    this.uuid = id
    this.type = type
    this.origin = origin
    if (this.type === 'file') {
      this.url = `file://${encodeURI(origin)}`
    } else {
      this.url = origin
    }
    this.title = this.getTitle()
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

  async add(type: SourceType, url: string): Promise<string> {

    // get a new id
    const source = new DocumentSourceImpl(uuidv4(), type, url)

    // load the content
    const loader = new Loader(this.config)
    const text = await loader.load(type, url)
    if (!text) {
      throw new Error('Unsupported document type')
    }

    // set title if web page
    if (type === 'url') {
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
    const embedder = new Embedder(this.config, this.embeddingEngine, this.embeddingModel)
    for (const chunk of chunks) {
      const embedding = await embedder.embed(chunk)
      documents.push({
        content: chunk,
        vector: embedding,
      })
    }
    
    // debug
    //console.log('Documents:', documents)
    
    // connect to the database
    const db = await lancedb.connect(databasePath(this.app, this.uuid))
    const tables = await db.tableNames()
    const index = tables.indexOf(DB_TABLE_NAME)
    if (index === -1) {
      throw new Error('Table not found')
    }

    // now store each document
    const table = await db.openTable(DB_TABLE_NAME)
    for (const document of documents) {

      await table.add([{
        id: uuidv4(),
        docid: source.uuid,
        content: document.content,
        vector: document.vector,
        vectorString: JSON.stringify(document.vector),
        metadata: JSON.stringify({
          id: source.uuid,
          type: source.type,
          title: source.getTitle(),
          url: source.url
        }),
      }])
    }
    
    // now store
    this.documents.push(source)
    console.log(`Embedded document "${source.url}" to database "${this.name}"`)

    // done
    return source.uuid

  }
}

export default class DocumentRepository {

  app: App
  config: Configuration
  contents: DocumentBaseImpl[] = []

  constructor(app: App) {
    this.app = app
    this.config = config.loadSettings(app)
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
            url: doc.url
          }
        })
      }
    })
  }

  load(): void {

    const docrepoFile = docrepoFilePath(this.app)
    try {

      const repoJson = fs.readFileSync(docrepoFile, 'utf-8')
      for (const db of JSON.parse(repoJson)) {
        const base = new DocumentBaseImpl(this.app, this.config, db.uuid, db.title, db.embeddingEngine, db.embeddingModel)
        for (const doc of db.documents) {
          base.documents.push(new DocumentSourceImpl(doc.uuid, doc.type, doc.origin))
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
    const embedder = new Embedder(this.config, embeddingEngine, embeddingModel)
    fs.mkdirSync(dbPath, { recursive: true })
    const db = await lancedb.connect(dbPath)
    await db.createTable(DB_TABLE_NAME, [{
      id: 'sample',
      docid: 'sample',
      content: 'sample',
      vector: Array(embedder.dimensions()).fill(0.0),
      vectorString: 'sample',
      metadata: 'sample',
    }])

    // log
    console.log('Created document database', databasePath(this.app, id))

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

  async addDocument(baseId: string, type: SourceType, url: string): Promise<string> {

    // get the base
    const base = this.contents.find(b => b.uuid == baseId)
    if (!base) {
      throw new Error('Database not found')
    }

    // add the document
    const id = await base.add(type, url)

    // done
    this.save()
    return id

  }

  async removeDocument(baseId: string, docId: string): Promise<void> {

    // find in the list
    const base = this.contents.find(b => b.uuid == baseId)
    if (!base) {
      throw new Error('Database not found')
    }

    // find the document
    const index = base.documents.findIndex(d => d.uuid == docId)
    if (index === -1) {
      throw new Error('Document not found')
    }

    // delete from the database
    const db = await lancedb.connect(databasePath(this.app, baseId))
    const table = await db.openTable(DB_TABLE_NAME)
    await table.delete(`docid == "${docId}"`)

    // remove it
    base.documents.splice(index, 1)

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
    const embedder = new Embedder(this.config, base.embeddingEngine, base.embeddingModel)
    const query = await embedder.embed(text)
    //console.log('query', query)

    // now query
    const db = await lancedb.connect(databasePath(this.app, baseId))
    const table = await db.openTable(DB_TABLE_NAME)
    const results = await table.search(query).limit(searchResultCount+10).toArray()
    //console.log('results', results)
    
    // done
    return results
      .filter((entry) => entry.id !== 'sample')
      .map((result) => {
        const metadata = JSON.parse(<string>result.metadata);
        const vector = JSON.parse(<string>result.vectorString);
        return {
          content: <string>result.content,
          score: embedder.similarity(query, vector),
          metadata: metadata,
        };
      })
      .filter((result) => result.score > 0.0)
      .sort((a, b) => b.score - a.score)
      .slice(0, searchResultCount);

  }

}
