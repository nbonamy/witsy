
import { Application, Automator } from '../types/automation';
import { runVbs } from '@el3um4s/run-vbs'

export default class implements Automator {

  async getForemostApp(): Promise<Application|null> {
    console.warn('getForemostApp not implemented (expected)');
    return null;
  }

  async selectAll() {

    const script = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      WshShell.SendKeys "^a"
      WScript.Sleep 200
    `

    // run it
    await runVbs({ vbs: script }) 
    
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

  async deleteSelectedText() {

    const script = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      WshShell.SendKeys "{DELETE}"
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
