
import { Application, Automator } from '../types/automation';
import { wait } from '../main/utils';

let nut: any|null = null;

const delay = 250;

export default class NutAutomator implements Automator {

  async setup() {
    if (nut) {
      return true;
    }
    try {
      const nutPackage = '@nut-tree-fork/nut-js';
      nut = await import(nutPackage);
      nut.keyboard.config.autoDelayMs = 10
      return true
    } catch {
      console.log('Error loading nutjs. Automation not available.');
      return false
    }
  }
  
  async getForemostApp(): Promise<Application|null> {
    console.warn('getForemostApp not implemented (expected)');
    return null;
  }

  async selectAll() {
    if (!await this.setup()) throw new Error('nutjs not loaded');
    await nut.keyboard.type(this.commandKey(), nut.Key.A);
    await wait(delay);
  }

  async moveCaretBelow() {
    if (!await this.setup()) throw new Error('nutjs not loaded');
    await nut.keyboard.type(nut.Key.Down);
    await nut.keyboard.type(nut.Key.Enter);
    await nut.keyboard.type(nut.Key.Enter);
    await wait(delay);
  }

  async copySelectedText() {
    if (!await this.setup()) throw new Error('nutjs not loaded');
    await nut.keyboard.pressKey(this.commandKey(), nut.Key.C);
    await nut.keyboard.releaseKey(this.commandKey(), nut.Key.C);
    //await wait(delay);
  }

  async deleteSelectedText() {
    if (!await this.setup()) throw new Error('nutjs not loaded');
    await nut.keyboard.type(nut.Key.Delete);
    await wait(delay);
  }

  async pasteText() {
    if (!await this.setup()) throw new Error('nutjs not loaded');
    await nut.keyboard.type(this.commandKey(), nut.Key.V);
    await wait(delay);
  }

  private commandKey() {
    return (process.platform === 'darwin') ? nut.Key.LeftCmd :  nut.Key.LeftControl;
  }

}
