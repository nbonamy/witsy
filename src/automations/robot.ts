
import { Automator } from '../types/automation.d';
import { wait } from '../main/utils';

export default class RobotAutomator implements Automator {

  robot: any
  
  constructor() {
    this.setup();
  }

  async setup() {
    try {
      const robotPackage = 'robotjs';
      this.robot = await import(robotPackage);
      return true
    } catch {
      console.log('Error loading robotjs. Disabling computer interaction.');
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
    if (!this.robot) throw new Error('Robotjs not loaded');
    this.robot.keyTap("a", process.platform === "darwin" ? "command" : "control");
    await wait();
  }

  async moveCaretBelow() {
    if (!this.robot) throw new Error('Robotjs not loaded');
    this.robot.keyTap("right");
    this.robot.keyTap("enter");
    this.robot.keyTap("enter");
    await wait();
  }

  async copySelectedText() {
    if (!this.robot) throw new Error('Robotjs not loaded');
    this.robot.keyTap("c", process.platform === "darwin" ? "command" : "control");
    await wait();
  }

  async pasteText() {
    if (!this.robot) throw new Error('Robotjs not loaded');
    this.robot.keyTap("v", process.platform === "darwin" ? "command" : "control");
    await wait();
  }

}
