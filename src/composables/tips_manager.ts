import { Store } from 'types/index'
import { t } from '../services/i18n'
import Dialog from './dialog'

export type TipId = 
  'engineSelector' | 'modelSelector' | 'conversation' |
  'computerUse' | 'realtime' | 'folderList' |
  'favoriteModels' | 'pluginsDisabled' | 'folderDefaults'

type TipHandler = () => Promise<boolean>

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

  showTip = async (tip: TipId, anyway: boolean = false) => {

    if (!anyway && !this.isTipAvailable(tip)) {
      return
    }

    // callbacks
    const callbacks: Record<TipId, TipHandler> = {
      'engineSelector': async () => { return false},
      'modelSelector': async () => { return false},
      'conversation': this.showConversationTip,
      'computerUse': this.showComputerUseWarning,
      'realtime': this.showRealtimeTip,
      'folderList': this.showFolderListTip,
      'favoriteModels': this.showFavoriteModelsTip,
      'pluginsDisabled': this.showPluginsDisabledTip,
      'folderDefaults': this.showFolderDefaultsTip,
    }

    // get the callback
    const callback = callbacks[tip]
    if (!callback) {
      console.error(`Unknown tip: ${tip}`)
      return
    }

    // call and done
    if (await callback()) {
      this.setTipShown(tip)
    }

  }

  showConversationTip = async () => {
    await Dialog.show({
      title: t('tips.conversation.title'),
    })
    return true
  }

  showComputerUseWarning = async () => {
    await Dialog.show({
      title: t('tips.computerUse.title'),
      text: t('tips.computerUse.text'),
    })
    return true
  }

  showRealtimeTip = async () => {
    await Dialog.show({
      title: t('tips.realtime.title'),
    })
    return true
  }
  
  showFolderListTip = async () => {
    await Dialog.show({
      title: t('tips.folderList.title'),
      text: t('tips.folderList.text'),
    })
    return true
  }

  showFavoriteModelsTip = async () => {
    await Dialog.show({
      title: t('tips.favoriteModels.title'),
      text: t('tips.favoriteModels.text'),
    })
    return true
  }

  showPluginsDisabledTip = async () => {
    const response = await Dialog.show({
      title: t('tips.pluginsDisabled.title'),
      text: t('tips.pluginsDisabled.text'),
      input: 'checkbox',
      inputLabel: t('tips.doNotShowAgain'),
    })
    return response.value
  }

  showFolderDefaultsTip = async () => {
    const response = await Dialog.show({
      title: t('tips.folderDefaults.title'),
      text: t('tips.folderDefaults.text'),
      input: 'checkbox',
      inputLabel: t('tips.doNotShowAgain'),
    })
    return response.value
  }

}

export default function useTipsManager(store: Store) {
  return new TipsManager(store)
}
