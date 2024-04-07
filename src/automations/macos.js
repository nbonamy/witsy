
var applescript = require('applescript');

export default class {

  constructor(config) {
    this.config = config
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

  getSelectedText() {

    const script = `
      set previous to the clipboard
      set the clipboard to ""
      tell application "System Events" to  keystroke "c" using command down      
      repeat 5 times
        delay 0.1
        set clipboardContents to the clipboard
        if clipboardContents is not "" then exit repeat
      end repeat
      set the clipboard to previous
      return clipboardContents
    `

    // run it
    return this._runScript(script);

  }

  pasteText(text) {

    const script = `
      set previous to the clipboard
      set the clipboard to "${text.replace(/"/g, '\\"')}"
      tell application "System Events" to keystroke "v" using command down      
      delay 0.1
      set the clipboard to previous
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
