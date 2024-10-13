
import Swal from 'sweetalert2/dist/sweetalert2.js'

const Dialog = {

  show: (opts: any): Promise<any> => {

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

  alert: (title: string): Promise<any> => {
    return Dialog.show({
      title: title,
    })
  }

}

export default Dialog
