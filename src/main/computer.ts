
import { ComputerAction } from 'types/index.d'
import { desktopCapturer, screen } from 'electron'
import nut from '../automations/nut'

//
// code from https://github.com/corbt/agent.exe
//

export type Point = { x: number, y: number }
export type Size = { width: number, height: number }

export default {

  isAvailable(): Promise<boolean> {
    return nut.isAvailable()
  },

  getActiveDisplay() {
    const cursorPoint = screen.getCursorScreenPoint()
    return screen.getDisplayNearestPoint(cursorPoint)
  },

  getScreenSize(): Size {
    const { width, height } = this.getActiveDisplay().size
    return { width, height }
  },

  getScreenNumber(): number {
    return 1//screen.getAllDisplays().indexOf(this.getActiveDisplay())
  },

  getScaledScreenSize(): Size {
    
    const targetWidth = 1280
    const targetHeight = 800

    let scaledWidth: number
    let scaledHeight: number

    const { width, height } = this.getScreenSize()
    const aspectRatio = width / height

    if (aspectRatio > targetWidth / targetHeight) {
      scaledWidth = targetWidth
      scaledHeight = Math.round(targetWidth / aspectRatio)
    } else {
      scaledHeight = targetHeight
      scaledWidth = Math.round(targetHeight * aspectRatio)
    }

    return { width: scaledWidth, height: scaledHeight }
  },

  realToScaled(x: number, y: number): Point {
    const { width, height } = this.getScreenSize()
    const aiDimensions = this.getScaledScreenSize()
    return {
      x: (x * aiDimensions.width) / width,
      y: (y * aiDimensions.height) / height,
    }
  },
  
  scaledToReal(x: number, y: number): Point {
    const { width, height } = this.getScreenSize()
    const aiDimensions = this.getScaledScreenSize()
    return {
      x: (x * width) / aiDimensions.width,
      y: (y * height) / aiDimensions.height,
    }
  },
  
  async takeScreenshot(): Promise<string> {

    try {

      const targetDimensions = this.getScaledScreenSize()
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: this.getActiveDisplay().size
      })
      const mainSource = sources.filter(s => s.name === 'Entire Screen' || s.name === 'Screen 1' || s.name === 'Entire screen')[0]
      const thumbnail = mainSource.thumbnail
      const resized = thumbnail.resize(targetDimensions)
      const jpeg64 = resized.toJPEG(95).toString('base64')
      return jpeg64

    } catch (e) {
      console.error('Error taking screenshot', e)
      return null
    }

  },

  async executeAction(action: ComputerAction): Promise<boolean|Point> {

    try {

      switch (action.action) {

        case 'cursor_position': {
          const cursorPosition = await nut.getCursorPosition()
          return this.realToScaled(cursorPosition.x, cursorPosition.y)
        }

        case 'mouse_move': {
          const mousePosition = this.scaledToReal(action.coordinate[0], action.coordinate[1])
          await nut.mouseMove(mousePosition.x, mousePosition.y)
          return true
        }

        case 'left_click': {
          await nut.leftClick()
          return true
        }

        case 'left_click_drag': {
          const dragPosition = this.scaledToReal(action.coordinate[0], action.coordinate[1])
          await nut.leftClickDrag(dragPosition.x, dragPosition.y)
          return true
        }

        case 'right_click': {
          await nut.rightClick()
          return true
        }

        case 'middle_click': {
          await nut.middleClick()
          return true
        }

        case 'double_click': {
          await nut.doubleClick()
          return true
        }

        case 'type':{
          await nut.type(action.text)
          return true
        }

        case 'key': {
          await nut.key(action.text)
          return true
        }

        default:
          throw new Error(`Unknown computer action ${action.action}`)

      }

    } catch (err) {
      console.error('Error executing computer action', err)
      return false
    }

  }

}