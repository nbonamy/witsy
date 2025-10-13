import { Plugin, PluginExecutionContext } from 'multi-llm-ts'

/**
 * Generic storage item with flexible metadata
 * Consumers should define their own types for the extra field
 */
export type StoreItem = {
  title: string
  body: string
  extra?: any  // Consumer-specific metadata
}

/**
 * Singleton storage with partition support for concurrent execution isolation
 * Each partition (typically a run UUID) has its own independent storage
 */
export class StorageSingleton {

  private static instance: StorageSingleton
  private storage: Record<string, Record<string, StoreItem>> = {}

  private constructor() {}

  static getInstance(): StorageSingleton {
    if (!StorageSingleton.instance) {
      StorageSingleton.instance = new StorageSingleton()
    }
    return StorageSingleton.instance
  }

  /**
   * Store content in a partition and return the generated ID
   */
  store(partitionId: string, title: string, body: string, extra?: any): string {
    while (true) {
      const partition = this.getPartition(partitionId)
      const id = crypto.randomUUID().split('-')[0]
      if (partition[id]) continue
      console.log('[store] Storing content:', title, extra ? `(with metadata)` : '')
      partition[id] = { title, body, extra }
      window.localStorage.setItem(`memory`, JSON.stringify(this.listTitles(partitionId), null, 2))
      return id
    }
  }

  /**
   * Retrieve content by ID from a partition
   */
  retrieve(partitionId: string, key: string): StoreItem {
    console.log('[store] Retrieving content:', key)
    const partition = this.getPartition(partitionId)
    const item = partition[key]
    return item
  }

  /**
   * List all titles in a partition
   */
  listTitles(partitionId: string): { id: string, title: string }[] {
    const partition = this.getPartition(partitionId)
    return Object.keys(partition).map(id => ({
      id,
      title: partition[id].title
    }))
  }

  /**
   * Clear all content in a partition
   */
  clear(partitionId: string): void {
    delete this.storage[partitionId]
    window.localStorage.removeItem('memory')
  }

  /**
   * Get all stored content in a partition (for debugging)
   */
  getAll(partitionId: string): Record<string, StoreItem> {
    return { ...this.getPartition(partitionId) }
  }

  private getPartition(partitionId: string): Record<string, StoreItem> {
    if (!this.storage[partitionId]) {
      this.storage[partitionId] = {}
    }
    return this.storage[partitionId]
  }
}

/**
 * Plugin for accessing short-term memory during LLM execution
 * Scoped to a specific partition for isolation
 */
export class MemoryPlugin extends Plugin {

  partitionId: string = 'default'

  constructor(partitionId: string) {
    super()
    this.partitionId = partitionId
  }

  setPartitionId(id: string): void {
    this.partitionId = id
  }

  getName(): string {
    return 'short_term_memory'
  }

  getDescription(): string {
    return 'Retrieve information by title'
  }

  getRunningDescription(): string {
    return ''
  }

  getParameters(): any[] {
    return [
      {
        name: 'id',
        type: 'string',
        description: 'The id of the content to retrieve',
        required: true
      }
    ]
  }

  async execute(context: PluginExecutionContext, params: any): Promise<any> {
    const { id } = params
    const storage = StorageSingleton.getInstance()
    const item = storage.retrieve(this.partitionId, id)
    if (item) {
      return item
    } else {
      return { error: `No content found for '${id}'` }
    }
  }

}
