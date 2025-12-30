import { expect, test, describe } from 'vitest'
import { Empty } from '../../../../src/cli/components/empty'

describe('Empty', () => {

  test('default height is 1', () => {
    const empty = new Empty()
    expect(empty.calculateHeight(80)).toBe(1)
  })

  test('custom height', () => {
    const empty = new Empty(3)
    expect(empty.calculateHeight(80)).toBe(3)
  })

  test('custom id', () => {
    const empty = new Empty(1, 'spacer')
    expect(empty.id).toBe('spacer')
  })

  test('render returns empty strings', () => {
    const empty = new Empty(3)
    const lines = empty.render(80)
    expect(lines).toEqual(['', '', ''])
  })

  test('setLines updates and marks dirty', () => {
    const empty = new Empty(1)
    empty.clearDirty()

    empty.setLines(5)

    expect(empty.isDirty()).toBe(true)
    expect(empty.calculateHeight(80)).toBe(5)
  })

  test('setLines same value does not mark dirty', () => {
    const empty = new Empty(3)
    empty.clearDirty()

    empty.setLines(3)

    expect(empty.isDirty()).toBe(false)
  })
})
