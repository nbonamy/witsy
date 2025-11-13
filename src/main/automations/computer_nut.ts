
//
// code from https://github.com/corbt/agent.exe
//

// get some enums from nut-js
// and declare some interfaces and variables
// to avoid typescript lint errors

enum Button {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2
}

enum Key {
  Enter = 102,
}

interface Point {
  x: number
  y: number
}

interface Mouse {
  getPosition(): Promise<Point>
  setPosition(point: Point): Promise<Mouse>
  click(button: any): Promise<Mouse>
  leftClick(): Promise<Mouse>
  rightClick(): Promise<Mouse>
  doubleClick(button: any): Promise<Mouse>
  drag(points: Point[]): Promise<Mouse>
}

interface Keyboard {
  config: any
  pressKey(...keys: any[]): Promise<Keyboard>
  type(text: string): Promise<Keyboard>
}

let mouse: Mouse
let keyboard: Keyboard

export default {

  async isAvailable(): Promise<boolean> {
    try {
      const nutPackage = '@nut-tree-fork/nut-js';
      ({ mouse, keyboard } = await import(nutPackage));
      return true
    } catch {
      console.log('Error loading nut-js. Disabling computer interaction.');
      return false
    }
  },

  async getCursorPosition(): Promise<Point> {
    return await mouse.getPosition()
  },

  async mouseMove(x: number, y: number) {
    await mouse.setPosition({ x, y })
  },

  async leftClick() {
    await mouse.leftClick()
  },

  async rightClick() {
    await mouse.rightClick()
  },

  async middleClick() {
    await mouse.click(Button.MIDDLE)
  },

  async doubleClick() {
    await mouse.doubleClick(Button.LEFT)
  },

  async leftClickDrag(x: number, y: number) {
    const position = await mouse.getPosition()
    return mouse.drag([position, { x, y }])
  },

  async key(text: string) {
    const keyMap = { Return: Key.Enter }
    const keys = text.split('+').map((key) => {
      const mappedKey = keyMap[key as keyof typeof keyMap];
      if (!mappedKey) {
        throw new Error(`Tried to press unknown key: ${key}`);
      }
      return mappedKey;
    });
    await keyboard.pressKey(...keys);
  },

  async type(text: string) {
    const oldDelay = keyboard.config.autoDelayMs
    keyboard.config.autoDelayMs = 0
    await keyboard.type(text)
    keyboard.config.autoDelayMs = oldDelay
  }

}