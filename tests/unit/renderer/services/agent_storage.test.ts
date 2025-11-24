import { vi, beforeEach, expect, test, describe } from 'vitest'
import { StorageSingleton, MemoryPlugin } from '@services/agent_storage'

describe('StorageSingleton', () => {
  let storage: StorageSingleton
  let randomUUIDSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset singleton instance for each test
    ;(StorageSingleton as any).instance = undefined
    storage = StorageSingleton.getInstance()

    // Mock crypto.randomUUID for predictable IDs
    randomUUIDSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  test('getInstance returns singleton', () => {
    const instance1 = StorageSingleton.getInstance()
    const instance2 = StorageSingleton.getInstance()
    expect(instance1).toBe(instance2)
  })

  test('store() returns generated ID', () => {
    const id = storage.store('partition1', 'Test Title', 'Test Body')
    expect(id).toBe('aaaaaaaa')
  })

  test('store() saves item with title and body', () => {
    const id = storage.store('partition1', 'My Title', 'My Body')
    const item = storage.retrieve('partition1', id)

    expect(item).toBeDefined()
    expect(item.title).toBe('My Title')
    expect(item.body).toBe('My Body')
    expect(item.extra).toBeUndefined()
  })

  test('store() saves item with extra metadata', () => {
    const extra = { userDeliverable: true, custom: 'value' }
    const id = storage.store('partition1', 'Title', 'Body', extra)
    const item = storage.retrieve('partition1', id)

    expect(item.extra).toEqual(extra)
  })

  test('retrieve() returns undefined for non-existent item', () => {
    const item = storage.retrieve('partition1', 'nonexistent')
    expect(item).toBeUndefined()
  })

  test('listTitles() returns empty array for empty partition', () => {
    const titles = storage.listTitles('partition1')
    expect(titles).toEqual([])
  })

  test('listTitles() returns all titles in partition', () => {
    // Mock multiple UUIDs
    let callCount = 0
    const uuids = ['id1-xxxx', 'id2-yyyy', 'id3-zzzz']
    randomUUIDSpy.mockImplementation(() => uuids[callCount++])

    storage.store('partition1', 'Title 1', 'Body 1')
    storage.store('partition1', 'Title 2', 'Body 2')
    storage.store('partition1', 'Title 3', 'Body 3')

    const titles = storage.listTitles('partition1')
    expect(titles).toHaveLength(3)
    expect(titles).toEqual([
      { id: 'id1', title: 'Title 1' },
      { id: 'id2', title: 'Title 2' },
      { id: 'id3', title: 'Title 3' }
    ])
  })

  test('getAll() returns all items in partition', () => {
    // Mock multiple UUIDs
    let callCount = 0
    const uuids = ['id1-xxxx', 'id2-yyyy']
    randomUUIDSpy.mockImplementation(() => uuids[callCount++])

    storage.store('partition1', 'Title 1', 'Body 1', { extra: 1 })
    storage.store('partition1', 'Title 2', 'Body 2', { extra: 2 })

    const all = storage.getAll('partition1')
    expect(Object.keys(all)).toHaveLength(2)
    expect(all['id1']).toEqual({ title: 'Title 1', body: 'Body 1', extra: { extra: 1 } })
    expect(all['id2']).toEqual({ title: 'Title 2', body: 'Body 2', extra: { extra: 2 } })
  })

  test('clear() removes partition', () => {
    storage.store('partition1', 'Title', 'Body')
    expect(storage.listTitles('partition1')).toHaveLength(1)
    storage.clear('partition1')
    expect(storage.listTitles('partition1')).toHaveLength(0)
  })

  test('Partitions are isolated from each other', () => {
    // Mock multiple UUIDs
    let callCount = 0
    const uuids = ['id1-xxxx', 'id2-yyyy', 'id3-zzzz']
    randomUUIDSpy.mockImplementation(() => uuids[callCount++])

    storage.store('partition1', 'P1 Title 1', 'P1 Body 1')
    storage.store('partition1', 'P1 Title 2', 'P1 Body 2')
    storage.store('partition2', 'P2 Title 1', 'P2 Body 1')

    expect(storage.listTitles('partition1')).toHaveLength(2)
    expect(storage.listTitles('partition2')).toHaveLength(1)

    const p1Titles = storage.listTitles('partition1')
    expect(p1Titles[0].title).toBe('P1 Title 1')
    expect(p1Titles[1].title).toBe('P1 Title 2')

    const p2Titles = storage.listTitles('partition2')
    expect(p2Titles[0].title).toBe('P2 Title 1')
  })

  test('Clearing one partition does not affect others', () => {
    storage.store('partition1', 'P1 Title', 'P1 Body')
    storage.store('partition2', 'P2 Title', 'P2 Body')

    storage.clear('partition1')

    expect(storage.listTitles('partition1')).toHaveLength(0)
    expect(storage.listTitles('partition2')).toHaveLength(1)
  })

  test('store() handles ID collision by retrying', () => {
    // Mock UUID to return duplicate, then unique
    let callCount = 0
    randomUUIDSpy.mockImplementation(() => {
      callCount++
      if (callCount === 1 || callCount === 2) {
        return 'duplicate-id-xxxx'
      }
      return `unique-xxxx-yyyy-zzzz`
    })

    const id1 = storage.store('partition1', 'Title 1', 'Body 1')
    const id2 = storage.store('partition1', 'Title 2', 'Body 2')

    expect(id1).toBe('duplicate')
    expect(id2).toBe('unique') // Collision on call 2, then succeeded on call 3
  })
})

describe('MemoryPlugin', () => {
  let storage: StorageSingleton
  let plugin: MemoryPlugin
  let randomUUIDSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    ;(StorageSingleton as any).instance = undefined
    storage = StorageSingleton.getInstance()
    plugin = new MemoryPlugin('test-partition')

    // Mock crypto.randomUUID for predictable IDs
    randomUUIDSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('unique-xxxx-yyyy-zzzz')
  })

  test('getName returns short_term_memory', () => {
    expect(plugin.getName()).toBe('short_term_memory')
  })

  test('getDescription returns description', () => {
    expect(plugin.getDescription()).toBe('Retrieve information by title')
  })

  test('getRunningDescription returns empty string', () => {
    expect(plugin.getRunningDescription()).toBe('')
  })

  test('getParameters returns id parameter', () => {
    const params = plugin.getParameters()
    expect(params).toHaveLength(1)
    expect(params[0].name).toBe('id')
    expect(params[0].type).toBe('string')
    expect(params[0].required).toBe(true)
  })

  test('setPartitionId updates partition', () => {
    plugin.setPartitionId('new-partition')
    expect(plugin.partitionId).toBe('new-partition')
  })

  test('execute retrieves item from partition', async () => {
    const id = storage.store('test-partition', 'Test Title', 'Test Body', { meta: 'data' })

    const result = await plugin.execute({} as any, { id })

    expect(result).toBeDefined()
    expect(result.title).toBe('Test Title')
    expect(result.body).toBe('Test Body')
    expect(result.extra).toEqual({ meta: 'data' })
  })

  test('execute returns error for non-existent item', async () => {
    const result = await plugin.execute({} as any, { id: 'nonexistent' })

    expect(result).toHaveProperty('error')
    expect(result.error).toContain('No content found')
  })

  test('execute uses correct partition', async () => {
    storage.store('partition1', 'P1 Title', 'P1 Body')
    storage.store('partition2', 'P2 Title', 'P2 Body')

    const plugin1 = new MemoryPlugin('partition1')
    const plugin2 = new MemoryPlugin('partition2')

    const id1 = storage.listTitles('partition1')[0].id
    const id2 = storage.listTitles('partition2')[0].id

    const result1 = await plugin1.execute({} as any, { id: id1 })
    const result2 = await plugin2.execute({} as any, { id: id2 })

    expect(result1.title).toBe('P1 Title')
    expect(result2.title).toBe('P2 Title')
  })

  test('execute respects partition changes via setPartitionId', async () => {
    // Mock different UUIDs for different partitions
    let callCount = 0
    randomUUIDSpy.mockImplementation(() => {
      callCount++
      if (callCount === 1) return 'id-partition1-xxxx'
      if (callCount === 2) return 'id-partition2-xxxx'
      return `unique-${callCount}-xxxx`
    })

    const id1 = storage.store('partition1', 'P1 Title', 'P1 Body')
    const id2 = storage.store('partition2', 'P2 Title', 'P2 Body')

    expect(id1).toBe('id')  // Split from 'id-partition1-xxxx'
    expect(id2).toBe('id')  // Split from 'id-partition2-xxxx'

    plugin.setPartitionId('partition1')
    const result1 = await plugin.execute({} as any, { id: id1 })
    expect(result1.title).toBe('P1 Title')

    plugin.setPartitionId('partition2')
    const result2 = await plugin.execute({} as any, { id: id2 })
    expect(result2.title).toBe('P2 Title')
  })
})

describe('StoreItem type safety', () => {
  test('StoreItem can hold any extra type', () => {
    const storage = StorageSingleton.getInstance()

    // Loop extra type
    const id1 = storage.store('p1', 'T1', 'B1', { userDeliverable: true })
    const item1 = storage.retrieve('p1', id1)
    const extra1 = item1.extra as { userDeliverable?: boolean }
    expect(extra1?.userDeliverable).toBe(true)

    // DeepResearch extra type
    const id2 = storage.store('p2', 'T2', 'B2', {
      componentType: 'section',
      sectionNumber: 3,
      searchResults: [{ title: 'Result', url: 'http://example.com' }]
    })
    const item2 = storage.retrieve('p2', id2)
    type DrExtra = {
      componentType?: string
      sectionNumber?: number
      searchResults?: Array<{ title: string, url: string }>
    }
    const extra2 = item2.extra as DrExtra
    expect(extra2?.componentType).toBe('section')
    expect(extra2?.sectionNumber).toBe(3)
    expect(extra2?.searchResults).toHaveLength(1)

    // No extra
    const id3 = storage.store('p3', 'T3', 'B3')
    const item3 = storage.retrieve('p3', id3)
    expect(item3.extra).toBeUndefined()
  })
})
