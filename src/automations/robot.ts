
import { Automator } from '@types/automation.d';
//import { keyTap } from 'robotjs';
//import { wait } from './utils';

export default class RobotAutomator implements Automator {
  
  async getForemostApp(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async selectAll() {
    // keyTap("a", process.platform === "darwin" ? "command" : "control");
    // await wait();
  }

  async moveCaretBelow() {
    // keyTap("right");
    // keyTap("enter");
    // keyTap("enter");
    // await wait();
  }

  async copySelectedText() {
    // keyTap("c", process.platform === "darwin" ? "command" : "control");
    // await wait();
  }

  async pasteText() {
    // keyTap("v", process.platform === "darwin" ? "command" : "control");
    // await wait();
  }

}
