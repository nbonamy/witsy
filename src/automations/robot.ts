
import { Automator } from '../types/automation';
import { wait } from '../main/utils';

let robot: any|null = null;

const delay = 500;


export default class RobotAutomator implements Automator {

    async setup() {
    if (robot) {
      return true;
    }
    try {
      const robotPackage = 'robotjs';
      robot = (await import(robotPackage)).default;
      return true
    } catch {
      console.log('Error loading robotjs. Automation not available.');
      return false
    }
  }
  
  async getForemostAppId(): Promise<string|null> {
    console.warn('getForemostAppId not implemented (expected)');
    return null;
  }

  async getForemostAppPath(): Promise<string|null> {
    console.warn('getForemostAppPath not implemented (expected)');
    return null;
  }

  async selectAll() {
    if (!await this.setup()) throw new Error('Robotjs not loaded');
    robot.keyTap('a', 'control');
    await wait(delay);
  }

  async moveCaretBelow() {
    if (!await this.setup()) throw new Error('Robotjs not loaded');
    robot.keyTap('down');
    robot.keyTap('enter');
    robot.keyTap('enter');
    await wait(delay);
  }

  async copySelectedText() {
    if (!await this.setup()) throw new Error('Robotjs not loaded');
    robot.keyTap('c', 'control');
    await wait(delay);
  }

  async pasteText() {
    if (!await this.setup()) throw new Error('Robotjs not loaded');
    robot.keyTap('v', 'control');
    await wait(delay);
  }

}
