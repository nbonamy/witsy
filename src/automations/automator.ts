
import { Application, Automator as AutomatorImpl } from '../types/automation';
import { removeMarkdown } from '@excalidraw/markdown-to-text'
import { clipboard } from 'electron';
import MacosAutomator from './macos'
import WindowsAutomator from './windows'
import NutAutomator from './nut'
import * as window from '../main/window'

export enum AutomationAction {
  INSERT_BELOW,
  REPLACE
}

export default class Automator {
  
  automator: AutomatorImpl;

  constructor() {
    if (process.platform === 'darwin') {
      this.automator = new MacosAutomator();
    } else if (process.platform === 'win32') {
      this.automator = new WindowsAutomator();
    } else {
      this.automator = new NutAutomator();
    }
  }

  async getForemostApp(): Promise<Application|null> {
    try {
      return await this.automator.getForemostApp();
    } catch (error) {
      console.warn(error);
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

  async deleteSelectedText(): Promise<void> {
    try {
      await this.automator.deleteSelectedText();
    } catch (error) {
      console.error(error);
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

  static automate = async (text: string, sourceApp: Application|null, action: AutomationAction): Promise<void> => {

    try {

      const result = removeMarkdown(text, {
        stripListLeaders: false,
        listUnicodeChar: ''
      });

      // done
      await window.closePromptAnywhere();
      await window.releaseFocus({ sourceApp });

      // now paste
      console.debug(`Processing LLM output: "${result.slice(0, 50)}"…`);

      // we need an automator
      const automator = new Automator();
      if (action === AutomationAction.INSERT_BELOW) {
        await automator.moveCaretBelow()
        await automator.pasteText(result)
      } else if (action === AutomationAction.REPLACE) {
        await automator.deleteSelectedText()
        await automator.pasteText(result)
      }

      // done
      return;

    } catch (error) {
      console.error('Error while testing', error);
    }

  }

}
