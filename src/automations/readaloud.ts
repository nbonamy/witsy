
import { App, Notification } from 'electron'
import { useI18n } from '../main/i18n'
import Automator from './automator'
import Automation from './automation'
import * as window from '../main/window'
import { putCachedText } from '../main/utils'

export default class ReadAloud {

  static read = async (app: App, timeout?: number): Promise<void> => {

    // localization
    const t = useI18n(app);

    // get selected text
    const automator = new Automator();
    const text = await Automation.grabSelectedText(automator, timeout);

    // error
    if (text == null) {
      try {
        new Notification({
          title: t('common.appName'),
          body: t('automation.grabError')
        }).show()
      } catch (error) {
        console.error('Error showing notification', error);
      }
      return;
    }

    // notify if no text
    if (text.trim() === '') {
      try {
        new Notification({
          title: t('common.appName'),
          body: t('automation.readAloud.emptyText')
        }).show()
        console.log('No text selected');
      } catch (error) {
        console.error('Error showing notification', error);
      }
      return;
    }

    // go on with a cached text id
    const textId = putCachedText(text);
    const sourceApp = await automator.getForemostApp();
    await window.openReadAloudPalette({ textId, sourceApp: JSON.stringify(sourceApp) });

  }

}