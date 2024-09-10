
import { LocalIndex } from 'vectra'

export default class VectorDB{

  static async create(path: string, dimensions: number): Promise<VectorDB> {
    const db = new VectorDB(path)
    await db.create(dimensions)
    return db
  }

  static async connect(path: string): Promise<VectorDB> {
    const db = new VectorDB(path)
    await db.connect()
    return db
  }

  path: string
  dimensions: number
  index: LocalIndex
  
  constructor(path: string) {
    this.path = path
  }

  async create(dimensions: number): Promise<void> {
    this.dimensions = dimensions
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

  async insert(docid: string, content: string, vector: number[], metadata: any): Promise<string> {
    const item = await this.index.insertItem({
      metadata: {
        docId: docid,
        content: content,
        metadata: metadata
      },
      vector:vector,
    })
    return item.id
  }

  async delete(docId: string): Promise<void> {
    const items = await this.index.listItemsByMetadata({ docId: docId })
    for (const item of items) {
      await this.index.deleteItem(item.id)
    }
  }

  async query(query: number[], searchResultCount: number) {
    return await this.index.queryItems(query, searchResultCount)
  }

}
