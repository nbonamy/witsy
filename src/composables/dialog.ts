
import Swal from 'sweetalert2/dist/sweetalert2.js'

export type DialogResult = {
  isConfirmed: boolean,
  isDenied: boolean,
  isDismissed: boolean,
}

const Dialog = {

  show: (opts: any): Promise<DialogResult> => {

    // if no input we rely on system dialogs
    if (!opts.input) {
      return Dialog.system(opts)
    }

    // automatic target for dialogs
    if (!opts.target) {
      const dialogs = document.querySelectorAll('dialog')
      for (const dialog of dialogs) {
        if (dialog.attributes.getNamedItem('open')) {
          // do not break as there could be multiple dialogs open
          opts.target = dialog
        }
      }
    }

    // add the icon
    opts.iconHtml = opts.iconHtml ?? '<img src="">'

    // add custom classes
    opts.customClass = {
      confirmButton: opts.showCancelButton ? 'alert-confirm' : 'alert-neutral',
      cancelButton: 'alert-neutral',
      denyButton: 'alert-danger',
      ...opts.customClass
    }

    // this is not very nice but don't want to go through the hassle
    // of getting base64 from file through preload and all of this!
    // also tried with a hardcoded base64 but it was ugly
    opts.willOpen = (e: any) => {
      try {
        const icon: Element =  e.querySelector('.swal2-icon .swal2-icon-content')
        const logo: Element = document.querySelector('#logo').cloneNode() as Element
        logo.removeAttribute('id')
        logo.removeAttribute('style')
        icon?.replaceChildren(logo)
      } catch (_) {
      }
    }

    // now do it
    return Swal.fire(opts)
  },

  alert: (title: string): Promise<DialogResult> => {
    return Dialog.show({
      title: title,
    })
  },

  system: (opts: any): Promise<DialogResult> => {

    const buttons  = [ ]
    let indices = { 'confirm': -1, 'deny': -1, 'cancel': -1 }
    if (opts.showDenyButton) {
      buttons.push(opts.confirmButtonText ?? 'OK')
      buttons.push(opts.denyButtonText)
      buttons.push(opts.cancelButtonText ?? 'Cancel')
      indices = { 'confirm': 0, 'deny': 1, 'cancel': 2 }
    } else if (opts.showCancelButton) {
      buttons.push(opts.cancelButtonText ?? 'Cancel')
      buttons.push(opts.confirmButtonText ?? 'OK')
      indices = { 'confirm': 1, 'deny': -1, 'cancel': 0 }
    } else {
      buttons.push(opts.confirmButtonText ?? 'OK')
      indices = { 'confirm': 0, 'deny': -1, 'cancel': -2 }
    }

    const sysopts = {
      type: 'none',
      message: opts.title,
      detail: opts.text,
      buttons: buttons,
      defaultId: indices.confirm,
    }

    const response = window.api.showDialog(sysopts)

    return Promise.resolve({
      isConfirmed: response === indices.confirm,
      isDenied: response === indices.deny,
      isDismissed: response === indices.cancel,
    })

  }

}

export default Dialog
