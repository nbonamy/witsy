
import * as lancedb from '@lancedb/lancedb'
import { v4 as uuidv4 } from 'uuid'

const DB_TABLE_NAME = 'vectors'

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
  db: lancedb.Connection
  table: lancedb.Table
  
  constructor(path: string) {
    this.path = path
  }

  async create(dimensions: number): Promise<void> {
    this.dimensions = dimensions
    this.db = await lancedb.connect(this.path)
    await this.db.createTable(DB_TABLE_NAME, [{
      id: 'sample',
      docid: 'sample',
      content: 'sample',
      vector: Array(dimensions).fill(0.0),
      vectorString: 'sample',
      metadata: 'sample',
    }])
    this.table = await this.db.openTable(DB_TABLE_NAME)
  }

  async connect(): Promise<void> {
    this.db = await lancedb.connect(this.path)
    const tables = await this.db.tableNames()
    const index = tables.indexOf(DB_TABLE_NAME)
    if (index === -1) {
      throw new Error('Table not found')
    }
    this.table = await this.db.openTable(DB_TABLE_NAME)
  }

  async insert(docid: string, content: string, vector: number[], metadata: any): Promise<string> {
    const id = uuidv4()
    await this.table.add([{
      id: id,
      docid: docid,
      content: content,
      vector:vector,
      vectorString: JSON.stringify(vector),
      metadata: JSON.stringify(metadata),
    }])
    return id
  }

  async delete(docId: string): Promise<void> {
    await this.table.delete(`docid == "${docId}"`)
  }

  async query(query: number[], searchResultCount: number) {
    return this.table.search(query).limit(searchResultCount).toArray()
  }

}
