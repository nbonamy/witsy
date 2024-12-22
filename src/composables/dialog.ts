
import Swal, { DialogResult as SwalDialogResult } from 'sweetalert2/dist/sweetalert2.js'

export type DialogResult = {
  isConfirmed: boolean,
  isDenied: boolean,
  isDismissed: boolean,
}

const Dialog = {

  show: (opts: any): Promise<DialogResult|typeof SwalDialogResult> => {

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
        const logo: Element = document.querySelector('#logo')!.cloneNode() as Element
        logo.removeAttribute('id')
        logo.removeAttribute('style')
        icon?.replaceChildren(logo)
      } catch (err) {
        if (!process.env.TEST) {
          console.warn('Could not replace logo', err)
        }
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

  system: async (opts: any): Promise<DialogResult> => {

    const buttons  = [ opts.confirmButtonText ?? 'OK' ]
    const indices = { 'confirm': 0, 'deny': -1, 'cancel': -1 }
    if (opts.showDenyButton) {
      buttons.push(opts.denyButtonText)
      indices.deny = buttons.length - 1
    }
    if (opts.showCancelButton) {
      buttons.push(opts.cancelButtonText ?? 'Cancel')
      indices.cancel = buttons.length - 1
    }

    const sysopts = {
      type: 'none',
      message: opts.title,
      detail: opts.text,
      buttons: buttons,
      defaultId: indices.confirm,
      cancelId: indices.cancel,
    }

    const value: Electron.MessageBoxReturnValue = await window.api.showDialog(sysopts)

    return {
      isConfirmed: value.response === indices.confirm,
      isDenied: value.response === indices.deny,
      isDismissed: value.response === indices.cancel,
    }

  }

}

export default Dialog
