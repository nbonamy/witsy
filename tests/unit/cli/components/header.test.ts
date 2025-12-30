import { expect, test, describe } from 'vitest'
import { Header } from '../../../../src/cli/components/header'

describe('Header', () => {

  test('has id "header"', () => {
    const header = new Header(8090)
    expect(header.id).toBe('header')
  })

  test('calculateHeight returns 4', () => {
    const header = new Header(8090)
    expect(header.calculateHeight(80)).toBe(4)
  })

  test('render returns 4 lines', () => {
    const header = new Header(8090)
    const lines = header.render(80)
    expect(lines.length).toBe(4)
  })

  test('render includes port', () => {
    const header = new Header(9999)
    const lines = header.render(80)
    expect(lines.some(l => l.includes('9999'))).toBe(true)
  })

  test('setPort updates and marks dirty', () => {
    const header = new Header(8090)
    header.clearDirty()

    header.setPort(9000)

    expect(header.isDirty()).toBe(true)
    const lines = header.render(80)
    expect(lines.some(l => l.includes('9000'))).toBe(true)
  })

  test('setPort same value does not mark dirty', () => {
    const header = new Header(8090)
    header.clearDirty()

    header.setPort(8090)

    expect(header.isDirty()).toBe(false)
  })
})
