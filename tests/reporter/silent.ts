
import { DotReporter } from 'vitest/reporters'

export default class SilentReporter extends DotReporter {

  onTestCaseReady() {}
  onTestCaseResult() {}

}