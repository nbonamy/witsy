
import { Application } from 'types/automation';
import { Configuration } from 'types/config';
import { app } from 'electron';
import { loadSettings } from '../config';
import { runVbs } from '@el3um4s/run-vbs'
import PowerShell from 'powershell'
import autolib from 'autolib';
import NutAutomator from './nut';

const pscript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class KeySender
{
  // constants
  private const int INPUT_KEYBOARD = 1;
  private const int KEYEVENTF_KEYUP = 0x0002;
  
  // key codes
  private const byte VK_CONTROL = 0x11;
  public const byte VK_C = 0x43;
  public const byte VK_V = 0x56;
  
  // simplified structure for INPUT
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT
  {
    public int type;
    public KEYBDINPUT ki;
    public long padding;  // padding to ensure the structure has the correct size
  }
  
  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT
  {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }
  
  // importing necessary functions
  [DllImport("user32.dll", SetLastError = true)]
  private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  
  [DllImport("user32.dll")]
  private static extern IntPtr GetMessageExtraInfo();
  
  [DllImport("user32.dll")]
  private static extern ushort MapVirtualKey(ushort uCode, uint uMapType);
  
  [DllImport("kernel32.dll")]
  private static extern uint GetLastError();

  // send control+key function
  public static uint SendCtrlKey(byte keyCode)
  {
    try
    {
      // inputs
      INPUT[] inputs = new INPUT[4];
      
      // get virtual key mappings
      ushort scanCtrl = MapVirtualKey(VK_CONTROL, 0);
      ushort scanKey = MapVirtualKey(keyCode, 0);
      
      // key down control
      inputs[0].type = INPUT_KEYBOARD;
      inputs[0].ki.wVk = VK_CONTROL;
      inputs[0].ki.wScan = scanCtrl;
      inputs[0].ki.dwFlags = 0;
      inputs[0].ki.time = 0;
      inputs[0].ki.dwExtraInfo = IntPtr.Zero;
      
      // key down key
      inputs[1].type = INPUT_KEYBOARD;
      inputs[1].ki.wVk = keyCode;
      inputs[1].ki.wScan = scanKey;
      inputs[1].ki.dwFlags = 0;
      inputs[1].ki.time = 0;
      inputs[1].ki.dwExtraInfo = IntPtr.Zero;
      
      // key up control
      inputs[2].type = INPUT_KEYBOARD;
      inputs[2].ki.wVk = VK_CONTROL;
      inputs[2].ki.wScan = scanCtrl;
      inputs[2].ki.dwFlags = KEYEVENTF_KEYUP;
      inputs[2].ki.time = 0;
      inputs[2].ki.dwExtraInfo = IntPtr.Zero;
      
      // key up key
      inputs[3].type = INPUT_KEYBOARD;
      inputs[3].ki.wVk = keyCode;
      inputs[3].ki.wScan = scanKey;
      inputs[3].ki.dwFlags = KEYEVENTF_KEYUP;
      inputs[3].ki.time = 0;
      inputs[3].ki.dwExtraInfo = IntPtr.Zero;
      
      // get structure size
      int inputSize = Marshal.SizeOf(typeof(INPUT));
      
      // now send inputs
      uint result = SendInput(4, inputs, inputSize);
      if (result != 4) {
        uint error = GetLastError();
        Console.WriteLine("Error in SendCtrlKey: " + error);
        return error;
      }
      
      return 0;
    
    } catch (Exception ex) {
      Console.WriteLine("Exception dans SendCtrlCExact : " + ex.Message);
      return 9999;
    }
  }

}
"@

# call it
[KeySender]::SendCtrlKey([KeySender]::@@KEY@@)
`

export default class extends NutAutomator {

  config: Configuration
  
  constructor() {
    super();
    this.setup();
    this.config = loadSettings(app)
  }

  async getForemostApp(): Promise<Application|null> {
    try {
      const app = await autolib.getForemostWindow();
      return {
        id: app.exePath,
        name: app.productName,
        path: app.exePath,
        window: app.title,
      }
    } catch {
      console.warn('getForemostApp not implemented (expected)');
      return null;
    }
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

    try {

      if (this.config.automation.altWinCopyPaste) {

        // this should work on all keyboards
        await this.executeControlKeyPowerShell('C')
    
      } else {

        // nut is faster but not always available
        if (!await this.setup()) throw new Error('nutjs not loaded');
        await this.nut().keyboard.pressKey(this.commandKey(), this.nut().Key.C);
        await this.nut().keyboard.releaseKey(this.commandKey(), this.nut().Key.C);

      }

    } catch {

      // fallback to vbs
      const script = `
        Set WshShell = WScript.CreateObject("WScript.Shell")
        WshShell.SendKeys "^c"
        WScript.Sleep 20
      `

      // run it
      await runVbs({ vbs: script }) 

    }

  }

  async pasteText() {

    try {

      if (this.config.automation.altWinCopyPaste) {

        // this should work on all keyboards
        await this.executeControlKeyPowerShell('V')
    
      } else {
        
        // nut is faster but not always available
        if (!await this.setup()) throw new Error('nutjs not loaded');
        await this.nut().keyboard.pressKey(this.commandKey(), this.nut().Key.V);
        await this.nut().keyboard.releaseKey(this.commandKey(), this.nut().Key.V);

      }

    } catch {

      // fallback to vbs
      const script = `
        Set WshShell = WScript.CreateObject("WScript.Shell")
        WshShell.SendKeys "^v"
        WScript.Sleep 20
    `

      // run it
      await runVbs({ vbs: script }) 

    }

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

  async activateApp(title: string) {

    const script = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      WshShell.AppActivate "${title}"
      WScript.Sleep 200
    `

    // run it
    await runVbs({ vbs: script }) 
  
  }

  async executeControlKeyPowerShell(key: string) {

    return new Promise<void>((resolve, reject) => {
      const script = pscript.replace('@@KEY@@', `VK_${key.toUpperCase()}`)
      const ps = new PowerShell(script);
      ps.on('error', (err: any) => {
        reject(err)
      })
      ps.on('end', () => {
        resolve()
      })
    })

  }

}
