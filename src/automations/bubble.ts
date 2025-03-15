
import { uIOhook, UiohookMouseEvent } from 'uiohook-napi'
import autolib from 'autolib'
import { openBubble } from '../main/window';
import { putCachedText } from '../main/utils';


export default class InPlaceBubble {

  processId: number = 0

  start() {

    if (process.platform !== 'darwin') {
      return
    }

    uIOhook.on('mousedown', async (e: UiohookMouseEvent) => {
      this.processId = autolib.getForemostProcessId();
      console.log('mousedown processId', this.processId);
    });

    uIOhook.on('mouseup', async (e: UiohookMouseEvent) => {

      try {

        // if we did not get a processId on mousedown, ignore
        if (this.processId === 0) {
          return;
        }

        // get the processId again to check if it has changed
        const currentProcessId = autolib.getForemostProcessId();
        console.log('mouseup currentProcessId', currentProcessId);

        // if the processId has changed since mousedown, ignore
        if (this.processId != currentProcessId) {
          this.processId = 0;
          return;
        }

        // reset processId for next mousedown
        this.processId = 0;

        // get selection with accessibility
        const text = autolib.getSelectedText();
        if (!text?.length) {
          return;
        }

        const textId = putCachedText(text);
        openBubble({ textId });

      } catch (error) {
        // no valid selection
        console.error('Error in bubble', error);
      }

    })

    // start listening for mouse events
    uIOhook.start()

  }

}
