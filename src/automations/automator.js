
import MacosAutomator from './macos'
import RobotAutomator  from './robot'

export default class {

  constructor() {
    if (process.platform === "darwin") {
      this.automator = new MacosAutomator();
    } else {
      this.automator = new RobotAutomator();
    }
  }

  async moveCaretBelow() {
    this.automator.moveCaretBelow();
  }

  async getSelectedText() {
    return this.automator.getSelectedText();
  }

  async pasteText(text) {
    this.automator.pasteText(text);
  }

}
