
import { DocumentMetadata } from '../types/rag'
import { IndexItem, IndexStats, LocalIndex, MetadataTypes, QueryResult } from 'vectra'

export default class VectorDB {

  static async create(path: string): Promise<VectorDB> {
    const db = new VectorDB(path)
    await db.create()
    return db
  }

  static async connect(path: string): Promise<VectorDB> {
    const db = new VectorDB(path)
    await db.connect()
    return db
  }

  path: string
  index: LocalIndex
  
  constructor(path: string) {
    this.path = path
  }

  async create(): Promise<void> {
    this.index = new LocalIndex(this.path)
    await this.index.createIndex()
  }

  async connect(): Promise<void> {
    this.index = new LocalIndex(this.path)
    await this.beginTransaction()
    await this.cancelTransaction()
  }

  beginTransaction(): Promise<void> {
    return this.index.beginUpdate()
  }

  cancelTransaction(): void {
    return this.index.cancelUpdate()
  }

  commitTransaction(): Promise<void> {
    return this.index.endUpdate()
  }

  async insert(docid: string, content: string, vector: number[], metadata: DocumentMetadata): Promise<string> {
    const item = await this.index.insertItem({
      metadata: {
        docId: docid,
        content: content,
        metadata: metadata as any,
      },
      vector:vector,
    })
    return item.id
  }

  async delete(docId: string): Promise<number> {
    const items = await this.index.listItemsByMetadata({ docId: docId })
    for (const item of items) {
      await this.index.deleteItem(item.id)
    }
    return items.length
  }

  async query(query: string, vector: number[], searchResultCount: number): Promise<QueryResult<Record<string,MetadataTypes>>[]> {
    return await this.index.queryItems(vector, query, searchResultCount)
  }

  async list(): Promise<IndexItem<Record<string,MetadataTypes>>[]> {
    return await this.index.listItems()
  }

  async stats(): Promise<IndexStats> {
    return await this.index.getIndexStats()
  }

}
