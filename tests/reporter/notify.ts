import { exec } from 'child_process'
import type { Reporter } from 'vitest/node'

export default class NotifyReporter implements Reporter {

  failed: boolean|undefined

  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    reason: TestRunEndReason
  ) {

    if (process.platform !== 'darwin') return

    if (reason === 'passed') {
      if (this.failed === true) {
        exec(`osascript -e 'display notification "All tests passing!"'`)
      }
      this.failed = false
    } else if (reason === 'failed' && this.failed !== false) {
      exec(`osascript -e 'display notification "Tests broken!"'`)
      this.failed = true
    }

  }
  
}