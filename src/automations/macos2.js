
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

  copySelectedText() {

    if (!editCopy) {
      throw 'Edit copy menu not found!'
    }

    const script = `
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
      tell application "System Events"
        set activeApp to name of first process whose frontmost is true
        tell process activeApp
          set frontmost to true
          click menu item "${editPaste[1]}" of menu "${editPaste[0]}" of menu bar 1
        end tell
      end tell
      delay 0.1
    `

    // run it
    return this._runScript(script);
    
  }

  async _findMenus() {

    // only once
    if (editCopy && editPaste) {
      return
    }

    const script = `
      on findMenu(shortcut1, shortcut2, modifier)
        set menuName to ""
        set menuItemName1 to ""
        set menuItemName2 to ""
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
                  if menuItemShortcut = shortcut1 and menuItemModifier = modifier then
                    set menuName to currentMenuName
                    set menuItemName1 to menuItemName
                  end if
                  if menuItemShortcut = shortcut2 and menuItemModifier = modifier then
                    set menuName to currentMenuName
                    set menuItemName2 to menuItemName
                  end if
                  if menuItemName1 ≠ "" and menuItemName2 ≠ "" then
                    return {menuName, menuItemName1, menuItemName2}
                  end if
                end try
              end repeat
            end repeat
          end tell
        end tell
      end findMenu
      return findMenu("c", "v", 0)
    `

    // now run
    console.log('Finding menus...')
    let result = await this._runScript(script);
    editCopy = [ result[0], result[1] ]
    editPaste = [ result[0], result[2] ]
    console.log('Menus found:', editCopy, editPaste)

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
