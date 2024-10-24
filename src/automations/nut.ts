
import { mouse, keyboard, Point, Button, Key } from "@nut-tree-fork/nut-js";

//
// code from https://github.com/corbt/agent.exe
//

export default {

  async getCursorPosition(): Promise<Point> {
    return await mouse.getPosition()
  },

  async mouseMove(x: number, y: number) {
    await mouse.setPosition({x, y})
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
    return mouse.drag([position, new Point(x, y)])
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