
import { Automator } from '../index'
import { runVbs } from '@el3um4s/run-vbs'

export default class implements Automator {

  constructor() {
  }

  async moveCaretBelow() {

    const script = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      WshShell.SendKeys "{DOWN}{ENTER}"
      WScript.Sleep 200
    `

    // run it
    await runVbs({ vbs: script }) 
  }

  async copySelectedText() {

    const script = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      WshShell.SendKeys "^c"
      WScript.Sleep 200
    `

    // run it
    await runVbs({ vbs: script }) 

  }

  async pasteText() {

    const script = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      WshShell.SendKeys "^v"
      WScript.Sleep 200
    `

    // run it
    await runVbs({ vbs: script }) 
    
  }

}
