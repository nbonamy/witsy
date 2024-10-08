
import { Store } from 'types'
import Swal from 'sweetalert2/dist/sweetalert2.js'

class TipsManager {

  store: Store

  constructor(store: Store) {
    this.store = store
  }

  showNextTip = () => {

    // not on 1st run
    if (this.store.config.general.firstRun) {
      this.store.config.general.firstRun = false
      this.store.saveSettings()
      return
    }

    const tipsToShow = [ 'scratchpad' ]

    for (const tip of tipsToShow) {
      const shouldShow = this.store.config.general.tips[tip]
      if (shouldShow) {
        this.showTip(tip)
        this.store.config.general.tips[tip] = false
        this.store.saveSettings()
        return
      }
    }

  }

  showTip = (tip: string) => {
    if (tip == 'scratchpad') {
      this.showScratchpadTip()
    } else {
      console.error(`Unknown tip: ${tip}`)
    }
  }

  showScratchpadTip = () => {
    Swal.fire({
      title: 'Witsy now includes an interactive scratchpad leveraging Generative AI to help you write the best content! It is available in the Witsy menu when you need it! Do you want to check it now?',
      confirmButtonText: 'Yes!',
      cancelButtonText: 'Later',
      showCancelButton: true,
    }).then((result: any) => {
      if (result.isConfirmed) {
        window.api.scratchpad.open()
      }
    })
  
  }

}

export default function useTipsManager(store: Store) {
  return new TipsManager(store)
}
