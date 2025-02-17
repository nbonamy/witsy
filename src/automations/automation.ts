
import Automator from './automator'
import { wait } from '../main/utils'

export default class {

  static grabSelectedText = async (automator: Automator, timeout: number = 2000): Promise<string> => {

    // wait for focus
    await wait(250)

    // get started
    const start = new Date().getTime();

    // grab text repeatedly
    let text = null;
    const grabStart = new Date().getTime();
    while (true) {
      text = await automator.getSelectedText();
      if (text != null && text.trim() !== '') {
        break;
      }
      if (new Date().getTime() - grabStart > timeout) {
        console.log(`Grab text timeout after ${timeout}ms`);
        break;
      }
      await wait(100);
    }

    // log
    if (text?.length) {
      console.debug(`Text grabbed: ${text.slice(0, 50)}… [${new Date().getTime() - start}ms]`);
    }

    // done
    return text;

  }

}