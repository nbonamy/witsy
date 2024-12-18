
import { Automator } from '../types/automation.d';
import { wait } from '../main/utils';

let robot: any|null = null;

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
  
  async getForemostAppId(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async getForemostAppPath(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async selectAll() {
    if (!await this.setup()) throw new Error('Robotjs not loaded');
    robot.keyTap('a', 'control');
    await wait(500);
  }

  async moveCaretBelow() {
    if (!await this.setup()) throw new Error('Robotjs not loaded');
    robot.keyTap('right');
    robot.keyTap('enter');
    robot.keyTap('enter');
    await wait(500);
  }

  async copySelectedText() {
    if (!await this.setup()) throw new Error('Robotjs not loaded');
    robot.keyTap('c', 'control');
    await wait(500);
  }

  async pasteText() {
    if (!await this.setup()) throw new Error('Robotjs not loaded');
    robot.keyTap('v', 'control');
    await wait(500);
  }

}
