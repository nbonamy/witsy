import { expect, test, describe } from 'vitest'
import { Footer } from '../../../../src/cli/components/footer'

describe('Footer', () => {

  test('id starts empty', () => {
    const footer = new Footer()
    expect(footer.id).toBe('')
  })

  test('calculateHeight returns 2', () => {
    const footer = new Footer()
    expect(footer.calculateHeight(80)).toBe(2)
  })

  test('render returns 2 lines', () => {
    const footer = new Footer()
    const lines = footer.render(80)
    expect(lines.length).toBe(2)
  })

  test('render includes separator', () => {
    const footer = new Footer()
    const lines = footer.render(80)
    // First line should be separator (contains ─ characters via chalk)
    expect(lines[0].length).toBeGreaterThan(0)
  })

  describe('text management', () => {
    test('setLeftText updates text', () => {
      const footer = new Footer()
      footer.setLeftText('Engine · Model')
      expect(footer.getLeftText()).toBe('Engine · Model')
    })

    test('setLeftText marks dirty', () => {
      const footer = new Footer()
      footer.clearDirty()

      footer.setLeftText('New text')

      expect(footer.isDirty()).toBe(true)
    })

    test('setLeftText same value does not mark dirty', () => {
      const footer = new Footer()
      footer.setLeftText('Same')
      footer.clearDirty()

      footer.setLeftText('Same')

      expect(footer.isDirty()).toBe(false)
    })

    test('setRightText updates text', () => {
      const footer = new Footer()
      footer.setRightText('? for shortcuts')
      expect(footer.getRightText()).toBe('? for shortcuts')
    })

    test('setRightText marks dirty', () => {
      const footer = new Footer()
      footer.clearDirty()

      footer.setRightText('New text')

      expect(footer.isDirty()).toBe(true)
    })

    test('setRightText same value does not mark dirty', () => {
      const footer = new Footer()
      footer.setRightText('Same')
      footer.clearDirty()

      footer.setRightText('Same')

      expect(footer.isDirty()).toBe(false)
    })
  })

  test('render includes left and right text', () => {
    const footer = new Footer()
    footer.setLeftText('Left')
    footer.setRightText('Right')

    const lines = footer.render(80)

    // Second line should contain both texts
    expect(lines[1]).toContain('Left')
    expect(lines[1]).toContain('Right')
  })
})
