
declare module 'applescript';
declare module 'powershell';

declare module 'autolib' {
  export interface KeyMonitorEvent {
    type: 'down' | 'up' | 'flagsChanged'
    keyCode: number
    flags: number
    isRepeat: boolean
  }

  export function sendKey(key: string, useModifier?: boolean): number
  export function getForemostProcessId(): number | null
  export function getForemostWindow(): { exePath: string; title: string; productName: string; processId: number } | null
  export function getProductName(exePath: string): string | null
  export function getApplicationIcon(exePath: string): { iconData: Buffer; iconWidth: number; iconHeight: number } | null
  export function getSelectedText(): string | null
  export function setForegroundWindow(hwnd: number): number
  export function activateWindow(hwnd: number): number
  export function mouseClick(x: number, y: number): number

  // Key monitor functions
  export function startKeyMonitor(callback: (event: KeyMonitorEvent) => void): number
  export function stopKeyMonitor(): number
  export function isKeyMonitorRunning(): boolean
}
