
import { Automator } from '../index.d'
//import { keyTap } from 'robotjs';
//import { wait } from './utils';

export default class RobotAutomator implements Automator {
  
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
