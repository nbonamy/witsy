
import { Automator } from '../index.d'
import applescript from 'applescript';

export default class implements Automator {

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
