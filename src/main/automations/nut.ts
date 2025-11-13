
import { Application, Automator } from 'types/automation';
import { wait } from '../utils';

let nut: any = undefined;

export default class NutAutomator implements Automator {

  nut() {
    return nut;
  }
  
  protected async setup() {
    if (nut) {
      return true;
    }
    if (nut === null) {
      return false;
    }
    try {
      const nutPackage = '@nut-tree-fork/nut-js';
      nut = await import(nutPackage);
      console.log('[nutjs] Loaded successfully.');
      return true;
    } catch {
      console.log('[nutjs] Error loading nutjs. Automation not available.');
      nut = null;
      return false
    }
  }

  async getForemostApp(): Promise<Application|null> {
    console.warn('[nutjs] getForemostApp not implemented (expected)');
    return null;
  }

  async selectAll() {
    if (!await this.setup()) throw new Error('[nutjs] nutjs not loaded');
    await nut.keyboard.type(this.commandKey(), nut.Key.A);
    await wait(this.delay());
  }

  async moveCaretBelow() {
    if (!await this.setup()) throw new Error('[nutjs] nutjs not loaded');
    await nut.keyboard.type(nut.Key.Down);
    await nut.keyboard.type(nut.Key.Enter);
    await nut.keyboard.type(nut.Key.Enter);
    await wait(this.delay());
  }

  async copySelectedText() {
    if (!await this.setup()) throw new Error('[nutjs] nutjs not loaded');
    await nut.keyboard.type(this.commandKey(), nut.Key.C);
    await wait(this.delay());
  }

  async deleteSelectedText() {
    if (!await this.setup()) throw new Error('[nutjs] nutjs not loaded');
    await nut.keyboard.type(nut.Key.Delete);
    await wait(this.delay());
  }

  async pasteText() {
    if (!await this.setup()) throw new Error('[nutjs] nutjs not loaded');
    await nut.keyboard.type(this.commandKey(), nut.Key.V);
    await wait(this.delay());
  }

  protected delay() {
    return 250;
  }

  protected commandKey() {
    return nut.Key.LeftControl;
  }

}
