
import { Automator } from '@types/automation.d';
import { clipboard } from 'electron';
import MacosAutomator from './macos'
import WindowsAutomator from './windows'
import RobotAutomator  from './robot'

export default class {
  
  automator: Automator;

  constructor() {
    if (process.platform === 'darwin') {
      this.automator = new MacosAutomator();
    } else if (process.platform === 'win32') {
      this.automator = new WindowsAutomator();
    } else {
      this.automator = new RobotAutomator();
    }
  }

  async getForemostApp(): Promise<string> {
    try {
      return await this.automator.getForemostApp();
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async selectAll(): Promise<void> {
    try {
      await this.automator.selectAll();
    } catch (error) {
      console.error(error);
    }
  }

  async moveCaretBelow(): Promise<void> {
    try {
      await this.automator.moveCaretBelow();
    } catch (error) {
      console.error(error);
    }
  }

  async getSelectedText(): Promise<string> {

    try {

      // save and set
      const clipboardText = clipboard.readText();
      clipboard.writeText('');

      // get it
      await this.automator.copySelectedText();
      const selectedText = clipboard.readText();

      // restore and done
      clipboard.writeText(clipboardText);
      return selectedText;

    } catch (error) {
      console.error(error);
      return null;
    }
  
  }

  async pasteText(textToPaste: string): Promise<void> {

    try {

      // save and set
      const clipboardText = clipboard.readText();
      clipboard.writeText(textToPaste);

      // paste it
      await this.automator.pasteText();

      // restore
      clipboard.writeText(clipboardText);
    
    } catch (error) {
      console.error(error);
    }

  }

  async copyToClipboard(text: string): Promise<void> {
    await clipboard.writeText(text)
  }

}
