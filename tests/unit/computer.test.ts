
import { vi, test, expect } from 'vitest'
import { screen } from 'electron'
import Computer from '../../src/main/computer'
import nut from '../../src/automations/computer_nut'
import { mouse, keyboard } from '@nut-tree-fork/nut-js'

const spyMove = vi.spyOn(nut, 'mouseMove')
const spyLeftClick = vi.spyOn(nut, 'leftClick')
const spyLeftClickDrag = vi.spyOn(nut, 'leftClickDrag')
const spyRightClick = vi.spyOn(nut, 'rightClick')
const spyMiddleClick = vi.spyOn(nut, 'middleClick')
const spyDoubleClick = vi.spyOn(nut, 'doubleClick')
const spyType = vi.spyOn(nut, 'type')
const spyKey = vi.spyOn(nut, 'key')

vi.mock('electron', async () => {
  return {
    screen: {
      getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
      getDisplayNearestPoint: vi.fn(() => ({ size: { width: 1920, height: 1080 } })),
    },
    desktopCapturer: {
      getSources: () => [
        { name: 'Entire Screen', thumbnail: { resize: () => ({ toJPEG: () => ({ toString: () => 'screenshot' }) }) } }
      ],
    },
  }
})

vi.mock('@nut-tree-fork/nut-js', async () => {
  return {
    mouse: {
      getPosition: vi.fn(() => ({ x: 0, y: 0 })),
      setPosition: vi.fn(),
      click: vi.fn(),
      leftClick: vi.fn(),
      rightClick: vi.fn(),
      doubleClick: vi.fn(),
      drag: vi.fn(),
    },
    keyboard: {
      config: { autoDelayMs: 0 },
      pressKey: vi.fn(),
      type: vi.fn(),
    },
  }
})

test('Is available', async () => {
  await expect(Computer.isAvailable()).resolves.toBe(true)
})

test('Get active display  ', async () => {
  expect(Computer.getActiveDisplay()).toBeDefined()
  expect(screen.getCursorScreenPoint).toHaveBeenCalled()
  expect(screen.getDisplayNearestPoint).toHaveBeenCalled()
})

test('Get screen info', async () => {
  expect(Computer.getScreenSize()).toEqual({ width: 1920, height: 1080 })
  expect(Computer.getScreenNumber()).toBe(1)
  expect(Computer.getScaledScreenSize()).toEqual({ width: 1280, height: 720 })
})

test('Coordinates conversion', async () => {
  expect(Computer.realToScaled(640, 400)).toEqual({ x: 1280/3, y: 800/3 })
  expect(Computer.scaledToReal(1280/3, 800/3)).toEqual({ x: 640, y: 400 })
})

test('Take screenshot', async () => {
  await expect(Computer.takeScreenshot()).resolves.toBe('screenshot')
})

test('Execute actions', async () => {
  await expect(Computer.executeAction({ action: 'cursor_position' })).resolves.toHaveProperty('x')
  await expect(Computer.executeAction({ action: 'cursor_position' })).resolves.toHaveProperty('y')
  expect(mouse.getPosition).toHaveBeenLastCalledWith()
  
  await expect(Computer.executeAction({ action: 'mouse_move', coordinate: [1280/3, 800/3] })).resolves.toBe(true)
  expect(spyMove).toHaveBeenLastCalledWith(640, 400)
  expect(mouse.setPosition).toHaveBeenLastCalledWith({ x: 640, y: 400 })

  await expect(Computer.executeAction({ action: 'left_click' })).resolves.toBe(true)
  expect(spyLeftClick).toHaveBeenCalled()
  expect(mouse.leftClick).toHaveBeenLastCalledWith()

  await expect(Computer.executeAction({ action: 'left_click_drag', coordinate: [1280/3, 800/3] })).resolves.toBe(true)
  expect(spyLeftClickDrag).toHaveBeenLastCalledWith(640, 400)
  expect(mouse.drag).toHaveBeenLastCalledWith([{ x: 0, y: 0 }, { x: 640, y: 400 }])

  await expect(Computer.executeAction({ action: 'right_click' })).resolves.toBe(true)
  expect(spyRightClick).toHaveBeenCalled()
  expect(mouse.rightClick).toHaveBeenLastCalledWith()

  await expect(Computer.executeAction({ action: 'middle_click' })).resolves.toBe(true)
  expect(spyMiddleClick).toHaveBeenCalled()
  expect(mouse.click).toHaveBeenLastCalledWith(1)

  await expect(Computer.executeAction({ action: 'double_click' })).resolves.toBe(true)
  expect(spyDoubleClick).toHaveBeenCalled()
  expect(mouse.doubleClick).toHaveBeenLastCalledWith(0)

  await expect(Computer.executeAction({ action: 'type', text: 'Hello' })).resolves.toBe(true)
  expect(spyType).toHaveBeenLastCalledWith('Hello')
  expect(keyboard.type).toHaveBeenLastCalledWith('Hello')

  await expect(Computer.executeAction({ action: 'key', text: 'Return' })).resolves.toBe(true)
  expect(spyKey).toHaveBeenLastCalledWith('Return')
  expect(keyboard.pressKey).toHaveBeenLastCalledWith(102)

})


