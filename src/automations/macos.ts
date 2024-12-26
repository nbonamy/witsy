
import { Automator } from '../types/automation';
import applescript from 'applescript';

export default class implements Automator {

  async getForemostAppId(): Promise<string> {

    const script = `
      tell application "System Events"
        set bundleID to bundle identifier of first application process whose frontmost is true
      end tell
      return bundleID
    `

    // run it
    const app = await this.runScript(script);
    return app as string;

  }

  async getForemostAppPath(): Promise<string> {

    const script = `
      tell application "System Events"
        set appPath to file of first application process whose frontmost is true
      end tell
      return appPath
    `

    // run it
    const app = await this.runScript(script);
    return (app as string).replace('/Volumes/Preboot/Cryptexes/App/System', '');

  }
  
  async selectAll(){
    
    const script = `
      tell application "System Events" to keystroke "a" using command down      
      delay 0.1
    `

    // run it
    await this.runScript(script);

  }

  async moveCaretBelow() {

    const script = `
    tell application "System Events"
        key code 124
        key code 36
        key code 36
      end tell
    `

    // run it
    await this.runScript(script);    
  }

  async copySelectedText() {

    const script = `
      set the clipboard to ""
      tell application "System Events" to keystroke "c" using command down      
      repeat 5 times
        delay 0.1
        set clipboardContents to the clipboard
        if clipboardContents is not "" then exit repeat
      end repeat
    `

    // run it
    await this.runScript(script);

  }

  async pasteText() {

    const script = `
      tell application "System Events" to keystroke "v" using command down      
      delay 0.1
    `

    // run it
    await this.runScript(script);
    
  }

  runScript(script: string) {
    return new Promise((resolve, reject) => {
      applescript.execString(script, (err: Error, rtn: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(rtn);
        }
      });
    });
  }

}
