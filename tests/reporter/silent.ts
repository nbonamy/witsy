import { DotReporter } from 'vitest/reporters'

export default class SilentReporter extends DotReporter {

  onTestCaseReady() {}
  onTestCaseResult() {}

  onTestRunEnd() {
    // Delay to ensure this prints after DotReporter's summary
    setTimeout(() => console.log('[TESTS:DONE]'), 100)
  }

}
