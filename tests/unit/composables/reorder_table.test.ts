import { vi, test, expect, describe, beforeEach } from 'vitest'
import useReorderTable from '../../../src/composables/reorder_table'

describe('useReorderTable', () => {
  let callback: ReturnType<typeof vi.fn>
  let reorderTable: ReturnType<typeof useReorderTable>

  beforeEach(() => {
    callback = vi.fn()
    reorderTable = useReorderTable(callback)
    document.body.innerHTML = ''
  })

  describe('onDragStart', () => {
    test('captures dragged row', () => {
      const table = document.createElement('table')
      const tbody = document.createElement('tbody')
      const row = document.createElement('tr')
      row.setAttribute('data-id', 'row1')
      tbody.appendChild(row)
      table.appendChild(tbody)

      const event = { target: row } as MouseEvent

      reorderTable.onDragStart(event)

      expect(reorderTable.draggedRow).toBe(row)
    })

    test('finds closest tr when target is child element', () => {
      const table = document.createElement('table')
      const tbody = document.createElement('tbody')
      const row = document.createElement('tr')
      const td = document.createElement('td')
      const span = document.createElement('span')

      row.setAttribute('data-id', 'row1')
      td.appendChild(span)
      row.appendChild(td)
      tbody.appendChild(row)
      table.appendChild(tbody)

      const event = { target: span } as MouseEvent

      reorderTable.onDragStart(event)

      expect(reorderTable.draggedRow).toBe(row)
    })
  })

  describe('onDragOver', () => {
    test('moves dragged row after target when target is above', () => {
      const table = document.createElement('table')
      const tbody = document.createElement('tbody')
      const row1 = document.createElement('tr')
      const row2 = document.createElement('tr')
      const row3 = document.createElement('tr')

      row1.setAttribute('data-id', 'row1')
      row2.setAttribute('data-id', 'row2')
      row3.setAttribute('data-id', 'row3')

      tbody.appendChild(row1)
      tbody.appendChild(row2)
      tbody.appendChild(row3)
      table.appendChild(tbody)

      // Drag row1 to position of row3
      reorderTable.draggedRow = row1
      const event = { target: row3 } as MouseEvent

      reorderTable.onDragOver(event)

      expect(tbody.children[0]).toBe(row2)
      expect(tbody.children[1]).toBe(row3)
      expect(tbody.children[2]).toBe(row1)
    })

    test('moves dragged row before target when target is below', () => {
      const table = document.createElement('table')
      const tbody = document.createElement('tbody')
      const row1 = document.createElement('tr')
      const row2 = document.createElement('tr')
      const row3 = document.createElement('tr')

      row1.setAttribute('data-id', 'row1')
      row2.setAttribute('data-id', 'row2')
      row3.setAttribute('data-id', 'row3')

      tbody.appendChild(row1)
      tbody.appendChild(row2)
      tbody.appendChild(row3)
      table.appendChild(tbody)

      // Drag row3 to position of row1
      reorderTable.draggedRow = row3
      const event = { target: row1 } as MouseEvent

      reorderTable.onDragOver(event)

      expect(tbody.children[0]).toBe(row3)
      expect(tbody.children[1]).toBe(row1)
      expect(tbody.children[2]).toBe(row2)
    })
  })

  describe('onDragEnd', () => {
    test('prevents default and calls callback with new order', () => {
      const table = document.createElement('table')
      const tbody = document.createElement('tbody')
      const row1 = document.createElement('tr')
      const row2 = document.createElement('tr')
      const row3 = document.createElement('tr')

      row1.setAttribute('data-id', 'id1')
      row2.setAttribute('data-id', 'id2')
      row3.setAttribute('data-id', 'id3')

      tbody.appendChild(row1)
      tbody.appendChild(row2)
      tbody.appendChild(row3)
      table.appendChild(tbody)

      reorderTable.draggedRow = row1

      const event = {
        preventDefault: vi.fn(),
        target: row1
      } as unknown as MouseEvent

      reorderTable.onDragEnd(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(callback).toHaveBeenCalledWith(['id1', 'id2', 'id3'])
    })

    test('calls callback with reordered IDs', () => {
      const table = document.createElement('table')
      const tbody = document.createElement('tbody')
      const row1 = document.createElement('tr')
      const row2 = document.createElement('tr')
      const row3 = document.createElement('tr')

      row1.setAttribute('data-id', 'id1')
      row2.setAttribute('data-id', 'id2')
      row3.setAttribute('data-id', 'id3')

      // Manually reorder to simulate drag result
      tbody.appendChild(row2)
      tbody.appendChild(row3)
      tbody.appendChild(row1)
      table.appendChild(tbody)

      reorderTable.draggedRow = row1

      const event = {
        preventDefault: vi.fn(),
        target: row1
      } as unknown as MouseEvent

      reorderTable.onDragEnd(event)

      expect(callback).toHaveBeenCalledWith(['id2', 'id3', 'id1'])
    })
  })

  describe('moveDown', () => {
    test('moves element down in list and returns true', () => {
      const list = ['a', 'b', 'c']
      const elem = 'a'

      const result = reorderTable.moveDown(elem, list, '#table')

      expect(result).toBe(true)
      expect(list).toEqual(['b', 'a', 'c'])
    })

    test('returns false when element is at bottom', () => {
      const list = ['a', 'b', 'c']
      const elem = 'c'

      const result = reorderTable.moveDown(elem, list, '#table')

      expect(result).toBe(false)
      expect(list).toEqual(['a', 'b', 'c'])
    })

    test('handles scroll when element is not first', () => {
      const list = ['a', 'b', 'c']
      const elem = 'b'

      // Create mock table for scrolling
      const table = document.createElement('table')
      table.id = 'test-table'
      const tbody = document.createElement('tbody')
      const row = document.createElement('tr')
      Object.defineProperty(row, 'clientHeight', { value: 50, writable: true })
      tbody.appendChild(row)
      table.appendChild(tbody)
      table.scrollBy = vi.fn()
      document.body.appendChild(table)

      const result = reorderTable.moveDown(elem, list, '#test-table')

      expect(result).toBe(true)
      expect(table.scrollBy).toHaveBeenCalledWith(0, 50)

      document.body.removeChild(table)
    })

    test('handles scroll errors gracefully', () => {
      const list = ['a', 'b', 'c']
      const elem = 'b'

      const result = reorderTable.moveDown(elem, list, '#nonexistent-table')

      expect(result).toBe(true)
      expect(list).toEqual(['a', 'c', 'b'])
    })
  })

  describe('moveUp', () => {
    test('moves element up in list and returns true', () => {
      const list = ['a', 'b', 'c']
      const elem = 'c'

      const result = reorderTable.moveUp(elem, list, '#table')

      expect(result).toBe(true)
      expect(list).toEqual(['a', 'c', 'b'])
    })

    test('returns false when element is at top', () => {
      const list = ['a', 'b', 'c']
      const elem = 'a'

      const result = reorderTable.moveUp(elem, list, '#table')

      expect(result).toBe(false)
      expect(list).toEqual(['a', 'b', 'c'])
    })

    test('handles scroll when moving up', () => {
      const list = ['a', 'b', 'c']
      const elem = 'b'

      // Create mock table for scrolling
      const table = document.createElement('table')
      table.id = 'test-table'
      const tbody = document.createElement('tbody')
      const row = document.createElement('tr')
      Object.defineProperty(row, 'clientHeight', { value: 50, writable: true })
      tbody.appendChild(row)
      table.appendChild(tbody)
      table.scrollBy = vi.fn()
      document.body.appendChild(table)

      const result = reorderTable.moveUp(elem, list, '#test-table')

      expect(result).toBe(true)
      expect(table.scrollBy).toHaveBeenCalledWith(0, -50)

      document.body.removeChild(table)
    })

    test('handles scroll errors gracefully', () => {
      const list = ['a', 'b', 'c']
      const elem = 'b'

      const result = reorderTable.moveUp(elem, list, '#nonexistent-table')

      expect(result).toBe(true)
      expect(list).toEqual(['b', 'a', 'c'])
    })
  })
})
