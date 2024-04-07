
var applescript = require('applescript');

let editCopy = null
let editPaste = null

export default class {

  constructor(config) {
    this.config = config
    this._findMenus()
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

    if (!editCopy) {
      throw 'Edit copy menu not found!'
    }

    const script = `
      set previous to the clipboard
      set the clipboard to ""
      tell application "System Events"
        set activeApp to name of first process whose frontmost is true
        tell process activeApp
          set frontmost to true
          click menu item "${editCopy[1]}" of menu "${editCopy[0]}" of menu bar 1
        end tell
      end tell
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

    if (!editPaste) {
      throw 'Edit paste menu not found!'
    }

    const script = `
      set previous to the clipboard
      set the clipboard to "${text.replace(/"/g, '\\"')}"
      tell application "System Events"
        set activeApp to name of first process whose frontmost is true
        tell process activeApp
          set frontmost to true
          click menu item "${editPaste[1]}" of menu "${editPaste[0]}" of menu bar 1
        end tell
      end tell
      delay 0.1
      set the clipboard to previous
    `

    // run it
    return this._runScript(script);
    
  }

  async _findMenus() {
    if (editCopy && editPaste) return
    if (!editCopy) editCopy = await this._findMenu('C', 0)
    if (!editPaste) editPaste = await this._findMenu('V', 0)
    console.log('Menus found:', editCopy, editPaste)
  }

  _findMenu(shortcut, modifier) {

    const script = `
      on findMenu(shortcut, modifier)
        tell application "System Events"
          set activeApp to name of first process whose frontmost is true
          tell process activeApp
            set menuBar to menu bar 1
            set menuCount to (count menus of menuBar)
            
            repeat with i from 1 to menuCount
              set currentMenu to menu i of menuBar
              set currentMenuName to name of currentMenu
              set menuItemCount to (count menu items of currentMenu)
              repeat with j from 1 to menuItemCount
                set currentMenuItem to menu item j of currentMenu
                try
                  set menuItemName to name of menu item j of currentMenu
                  set menuItemShortcut to value of attribute "AXMenuItemCmdChar" of currentMenuItem
                  set menuItemModifier to value of attribute "AXMenuItemCmdModifiers" of currentMenuItem
                  if menuItemShortcut = shortcut and menuItemModifier = modifier then
                    return {currentMenuName, menuItemName}
                  end if
                end try
              end repeat
            end repeat
          end tell
        end tell
      end findMenu
      return findMenu("${shortcut}", ${modifier})
    `

    // now run
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
