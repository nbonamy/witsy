import { execSync } from 'child_process'
import { shell, systemPreferences } from 'electron'

export default class MacOSPermissions {

  /**
   * Check if accessibility permissions are granted
   */
  static async checkAccessibility(): Promise<boolean> {
    try {
      // Use the proper Electron API to check accessibility permissions
      // This returns true if the app is a trusted accessibility client
      return systemPreferences.isTrustedAccessibilityClient(false)
    } catch (error) {
      console.warn('Accessibility permission check failed:', error)
      return false
    }
  }

  /**
   * Check if automation permissions are granted
   */
  static async checkAutomation(): Promise<boolean> {
    try {
      // Check automation by trying a simple System Events command
      // This will fail if automation permissions are not granted to the app
      const script = `
        tell application "System Events"
          return (count of application processes) > 0
        end tell
      `
      
      const result = execSync(`osascript -e '${script}'`, { 
        timeout: 5000, 
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'] // Suppress stderr to avoid noise in logs
      })
      return result.trim() === 'true'
    } catch (error) {
      console.warn('Automation permission check failed:', error)
      return false
    }
  }

  /**
   * Open System Preferences to Accessibility settings
   */
  static async openAccessibilitySettings(): Promise<void> {
    try {
      // Open Security & Privacy > Privacy > Accessibility
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
    } catch (error) {
      console.error('Failed to open accessibility settings:', error)
      // Fallback to general Privacy settings
      try {
        await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy')
      } catch (fallbackError) {
        console.error('Failed to open privacy settings:', fallbackError)
        // Final fallback to System Preferences
        await shell.openExternal('x-apple.systempreferences:')
      }
    }
  }

  /**
   * Open System Preferences to Automation settings
   */
  static async openAutomationSettings(): Promise<void> {
    try {
      // Open Security & Privacy > Privacy > Automation
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Automation')
    } catch (error) {
      console.error('Failed to open automation settings:', error)
      // Fallback to general Privacy settings
      try {
        await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy')
      } catch (fallbackError) {
        console.error('Failed to open privacy settings:', fallbackError)
        // Final fallback to System Preferences
        await shell.openExternal('x-apple.systempreferences:')
      }
    }
  }

}
