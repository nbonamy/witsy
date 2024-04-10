
var applescript = require('applescript');

export default class {

  constructor() {
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
    return this._runScript(script);    
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
    return this._runScript(script);

  }

  async pasteText() {

    const script = `
      tell application "System Events" to keystroke "v" using command down      
      delay 0.1
    `

    // run it
    return this._runScript(script);
    
  }


  _runScript(script) {
    return new Promise((resolve, reject) => {
      applescript.execString(script, (err, rtn) => {
        if (err) {
          reject(err);
        } else {
          resolve(rtn);
        }
      });
    });
  }

}
