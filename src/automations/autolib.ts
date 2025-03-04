
let autolib: any = undefined;

export default class AutolibAutomator {

  public async setup() {
    if (autolib) {
      return true;
    }
    if (autolib === null) {
      return false;
    }
    try {
      const autolibPackage = 'autolib';
      autolib = await import(autolibPackage);
      return true
    } catch {
      console.log('Error loading autolib.');
      autolib = null;
      return false
    }
  }

  sendCtrlKey = async (key: string): Promise<void> => {
    if (!await this.setup()) throw new Error('autolib not loaded');
    const result = await autolib.sendCtrlKey(key);
    if (result != 1) {
      throw new Error('Error sending Ctrl+C. Trying something else.');
    }
  }

}
