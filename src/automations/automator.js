
import { clipboard } from 'electron';
import MacosAutomator from './macos'
import WindowsAutomator from './windows'
import RobotAutomator  from './robot'

export default class {

  constructor() {
    if (process.platform === 'darwin') {
      this.automator = new MacosAutomator();
    } else if (process.platform === 'win32') {
      this.automator = new WindowsAutomator();
    } else {
      this.automator = new RobotAutomator();
    }
  }

  async moveCaretBelow() {
    await this.automator.moveCaretBelow();
  }

  async getSelectedText() {

    // save and set
    const clipboardText = clipboard.readText();
    clipboard.writeText('');

    // get it
    await this.automator.copySelectedText();
    const selectedText = clipboard.readText();

    // restore and done
    clipboard.writeText(clipboardText);
    return selectedText;
  
  }

  async pasteText(textToPaste) {

    // save and set
    const clipboardText = clipboard.readText();
    clipboard.writeText(textToPaste);

    // paste it
    await this.automator.pasteText();

    // restore
    clipboard.writeText(clipboardText);
  
  }

}
