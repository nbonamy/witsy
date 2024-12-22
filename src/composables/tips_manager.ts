
import { Store } from 'types/index.d'
import Dialog from './dialog'

export type TipId = 'scratchpad' | 'conversation' | 'computerUse' | 'newPrompt' | 'newCommand' | 'realtime' | 'folderList'

class TipsManager {

  store: Store

  constructor(store: Store) {
    this.store = store
  }

  isTipAvailable = (tip: TipId) => {
    return this.store.config.general.tips[tip] === undefined || this.store.config.general.tips[tip] === true
  }

  setTipShown = (tip: TipId) => {
    this.store.config.general.tips[tip] = false
    this.store.saveSettings()
  }

  showNextTip = () => {

    // not on 1st run
    if (this.store.config.general.firstRun) {
      this.store.config.general.firstRun = false
      this.store.saveSettings()
      return
    }

    const tipsToShow: TipId[] = [ 'scratchpad', 'newPrompt' ]

    for (const tip of tipsToShow) {
      if (this.isTipAvailable(tip)) {
        this.showTip(tip)
        return
      }
    }

  }

  showTip = (tip: TipId, anyway: boolean = false) => {

    if (!anyway && !this.isTipAvailable(tip)) {
      return
    }

    // callbacks
    const callbacks: { [key: string]: CallableFunction } = {
      'scratchpad': this.showScratchpadTip,
      'conversation': this.showConversationTip,
      'computerUse': this.showComputerUseWarning,
      'newPrompt': this.showNewPromptTip,
      'newCommand': this.showNewCommandTip,
      'realtime': this.showRealtimeTip,
      'folderList': this.showFolderListTip,
    }

    // get the callback
    const callback = callbacks[tip]
    if (!callback) {
      console.error(`Unknown tip: ${tip}`)
      return
    }

    // call and done
    this.setTipShown(tip)
    callback()

  }

  showScratchpadTip = () => {
    Dialog.show({
      title: 'Witsy includes an interactive scratchpad leveraging Generative AI to help you write the best content!',
      text: 'Do you want to check it now? It is available in the Witsy menu when you need it!',
      confirmButtonText: 'Yes!',
      cancelButtonText: 'Later',
      showCancelButton: true,
    }).then((result: any) => {
      if (result.isConfirmed) {
        window.api.scratchpad.open()
      }
    })
  
  }

  showConversationTip = () => {
    Dialog.show({
      title: 'Check the conversation options by right-clicking on the microphone icon in the chat window.',
    })
  }

  showComputerUseWarning = () => {
    Dialog.show({
      title: 'Computer Use will interact with your computer and perform mouse and keyboard actions. These actions may cause unexpected behavior which could result in data loss.',
      text: 'Use at your own risk!',
    })
  }

  showNewPromptTip = () => {
    Dialog.show({
      title: 'Prompt Anywhere gives you faster than ever to Generative AI!',
      text: 'Do you want to check it now? It is available in the Witsy menu when you need it!',
      confirmButtonText: 'Yes!',
      cancelButtonText: 'Later',
      showCancelButton: true,
    }).then((result: any) => {
      if (result.isConfirmed) {
        window.api.anywhere.prompt()
      }
    })
  
  }

  showNewCommandTip = () => {
    Dialog.show({
      title: 'The AI Command feature has been completely redesigned and gives you more flexibility than ever!',
      text: 'Replace, Insert and other commands are available at the bottom of the response window.',
      confirmButtonText: 'Got it!',
    })
  }

  showRealtimeTip = () => {
    Dialog.show({
      title: 'Realtime chat can quickly be expensive. The estimated cost provided is just an estimate and may not be correct. Click on the blob to start and stop chatting!',
    })
  }
  
  showFolderListTip = () => {
    Dialog.show({
      title: `The folder list is a great way to organize your chat sessions. Click on the folder icon at the bottom of the sidebar to create new folders.
      
      The menu on the right of every folder allows you to manage your folders.
      
      The context menu of your chats allows you to move them to a folder.`,
    })
  }

}

export default function useTipsManager(store: Store) {
  return new TipsManager(store)
}
