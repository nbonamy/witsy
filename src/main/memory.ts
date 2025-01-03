
import { MemoryFact } from '../types/index'
import { App } from 'electron'
import VectorDB from '../rag/vectordb'
import Embedder from '../rag/embedder'
import defaultSettings from '../../defaults/settings.json'
import * as config from '../main/config'
import path from 'path'
import fs from 'fs'

export default class MemoryManager {

  app: App
  db: VectorDB

  constructor(app: App) {
    this.app = app
  }

  async isNotEmpty(): Promise<boolean> {
    if (!this.  db) {
      await this.open()
    }
    if (!this.db) return false
    const stats = await this.db.stats()
    return stats.items > 0
  }

  async list(): Promise<MemoryFact[]> {
    if (!this.db) {
      await this.open()
    }
    if (!this.db) return []
    const results = await this.db.list()
    return results.map((result) => ({
      uuid: result.metadata.docId as string,
      content: result.metadata.content as string
    }))
  }

  async reset(): Promise<void> {
    await this.destroy()
    this.db = null
  }

  async store(contents: string[]): Promise<boolean> {

    // we need a connection and embedder
    await this.connect()
    const embedder = await this.embedder()

    // embed each content separately
    for (const content of contents) {
      const embeddings = await embedder.embed([content])
      const uuid = crypto.randomUUID()
      this.db.insert(uuid, content, embeddings[0], {
        uuid: uuid,
        type: 'text',
        title: '',
        url: '',
      })
    }

    return true
  }
  
  async query(query: string): Promise<string[]> {

    // needed
    const searchResultCount = defaultSettings.rag.searchResultCount
    const relevanceCutOff = defaultSettings.rag.relevanceCutOff

    // we need a connection
    await this.connect()

    // and embeddings
    const embedder = await this.embedder()
    const embeddings = await embedder.embed([query])

    // now query
    const results = await this.db.query(embeddings[0], 10)
    return results
      .filter((result) => result.score > relevanceCutOff)
      .map((result) => result.item.metadata.content as string)
      .slice(0, searchResultCount)
  }

  async delete(uuid: string): Promise<boolean> {

    // we need a connection
    await this.connect()
    if (!this.db) return false

    // delete
    const count = await this.db.delete(uuid)
    return count > 0
  }

  private async connect() {
    if (!this.db) {
      if (!await this.open()) {
        await this.create()
        await this.open()
      }
    }
  }

  private async open() {
    const dbPath = this.databasePath()
    if (!fs.existsSync(dbPath)) return false;
    this.db = await VectorDB.connect(dbPath)
    return true;
  }

  private async create() {
    const dbPath = this.databasePath()
    fs.mkdirSync(dbPath, { recursive: true })
    const settings = await config.loadSettings(this.app)
    await VectorDB.create(dbPath, await Embedder.dimensions(settings, settings.plugins.memory.engine, settings.plugins.memory.model))
  }

  private async destroy() {
    const dbPath = this.databasePath()
    await fs.promises.rm(dbPath, { recursive: true, force: true })
  }
  
  private databasePath = (): string => {
    const userDataPath = this.app.getPath('userData')
    const databasePath = path.join(userDataPath, 'memory')
    return databasePath
  }

  private async embedder(): Promise<Embedder> {
    const settings = await config.loadSettings(this.app)
    return await Embedder.init(this.app, settings, settings.plugins.memory.engine, settings.plugins.memory.model)
  }


}
