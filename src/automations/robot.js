
import { clipboard } from 'electron';
//import { keyTap } from 'robotjs';
//import { wait } from './utils';

export default class RobotAutomator {
  
  constructor() {
  }

  async moveCaretBelow() {
    // keyTap("right");
    // keyTap("enter");
    // keyTap("enter");
  }

  async copySelectedText() {
    const currentClipboardContent = clipboard.readText();
    return currentClipboardContent;
    // clipboard.clear();
    // keyTap("c", process.platform === "darwin" ? "command" : "control");
    // await wait();
    // const selectedText = clipboard.readText();
    // clipboard.writeText(currentClipboardContent);
    // return selectedText;
  }

  async pasteText(text) {
    // const currentClipboardContent = clipboard.readText();
    clipboard.writeText(text)
    // keyTap("v", process.platform === "darwin" ? "command" : "control");
    // await wait();
    // clipboard.writeText(currentClipboardContent);
  }

}
