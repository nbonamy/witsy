import { Store } from 'types/index'
import { t } from '../services/i18n'
import Dialog from './dialog'

export type TipId = 
  'engineSelector' | 'modelSelector' | 'conversation' |
  'computerUse' | 'realtime' | 'folderList' |
  'favoriteModels'

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

    const tipsToShow: TipId[] = [  /* nothing for now */]

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
      'conversation': this.showConversationTip,
      'computerUse': this.showComputerUseWarning,
      'realtime': this.showRealtimeTip,
      'folderList': this.showFolderListTip,
      'favoriteModels': this.showFavoriteModelsTip,
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

  showConversationTip = () => {
    Dialog.show({
      title: t('tips.conversation.title'),
    })
  }

  showComputerUseWarning = () => {
    Dialog.show({
      title: t('tips.computerUse.title'),
      text: t('tips.computerUse.text'),
    })
  }

  showRealtimeTip = () => {
    Dialog.show({
      title: t('tips.realtime.title'),
    })
  }
  
  showFolderListTip = () => {
    Dialog.show({
      title: t('tips.folderList.title'),
    })
  }

  showFavoriteModelsTip = () => {
    Dialog.show({
      title: t('tips.favoriteModels.title'),
    })
  }

}

export default function useTipsManager(store: Store) {
  return new TipsManager(store)
}
