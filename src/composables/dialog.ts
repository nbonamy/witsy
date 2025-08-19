
import Swal, { DialogResult as SwalDialogResult } from 'sweetalert2/dist/sweetalert2.js'
import { t } from '../services/i18n'

export type DialogOptions = {
  title: string
  text?: string
  target?: HTMLElement
  html?: string
  iconHtml?: string
  customClass?: Record<string, string>
  input?: string
  inputLabel?: string
  inputValue?: string
  inputOptions?: Record<string, any>
  inputAttributes?: Record<string, any>
  inputPlaceholder?: string
  inputValidator?: (value: any) => string | Promise<string> | null
  showConfirmButton?: boolean
  showCancelButton?: boolean
  showDenyButton?: boolean
  reverseButtons?: boolean
  confirmButtonText?: string
  cancelButtonText?: string
  denyButtonText?: string
  preConfirm?: (value: any) => any
  willOpen?: (e: any) => void
  didOpen?: (e: any) => void
  didClose?: (e: any) => void
}

export type DialogResult = {
  isConfirmed: boolean
  isDenied: boolean
  isDismissed: boolean
}

const Dialog = {

  alert: (title: string, text?: string): Promise<DialogResult> => {
    return Dialog.show({ title, text })
  },

  show: (opts: DialogOptions): Promise<DialogResult|typeof SwalDialogResult> => {

    // check if there is already one open
    if (Swal.isVisible()) {
      if (opts.showDenyButton) {
        throw new Error('Cannot open a new dialog while another one is open with deny button')
      } else if (opts.showCancelButton) {
        const rc = confirm(`${opts.title}\n\n${opts.text || ''}`)
        return Promise.resolve({
          isConfirmed: rc,
          isDenied: false,
          isDismissed: !rc
        })
      } else {
        alert(`${opts.title}\n\n${opts.text || ''}`)
        return Promise.resolve({
          isConfirmed: true,
          isDenied: false,
          isDismissed: false
        })
      }
    }

    // automatic target for dialogs
    opts.target = document.querySelector('body') as HTMLElement
    // if (!opts.target) {
    //   const dialogs = document.querySelectorAll('dialog')
    //   for (const dialog of dialogs) {
    //     if (dialog.attributes.getNamedItem('open')) {
    //       // do not break as there could be multiple dialogs open
    //       opts.target = dialog
    //     }
    //   }
    // }

    // add the icon
    opts.iconHtml = undefined//opts.iconHtml ?? '<img src="">'

    // add custom classes
    opts.customClass = {
      popup: 'form form-large',
      confirmButton: opts.showCancelButton ? 'alert-confirm' : 'alert-neutral',
      cancelButton: 'alert-cancel',
      denyButton: 'alert-neutral',
      ...opts.customClass
    }

    // change text to texarea
    if (opts.input === 'text') {
      opts.input = 'textarea'
      opts.customClass.input = 'text-textarea'
    }

    // i18n labels
    if (!opts.confirmButtonText) {
      opts.confirmButtonText = t('common.ok')
    }
    if (opts.showCancelButton && !opts.cancelButtonText) {
      opts.cancelButtonText = t('common.cancel')
    }
    if (opts.showDenyButton && !opts.denyButtonText) {
      opts.denyButtonText = t('common.no')
    }

    // // setup
    // opts.willOpen = (e: any) => {
    //   try {
    //     // this is not very nice but don't want to go through the hassle
    //     // of getting base64 from file through preload and all of this!
    //     // also tried with a hardcoded base64 but it was ugly
    //     const icon: Element =  e.querySelector('.swal2-icon .swal2-icon-content')
    //     const logo: Element = document.querySelector('#logo')!.cloneNode() as Element
    //     logo.removeAttribute('id')
    //     logo.removeAttribute('style')
    //     icon?.replaceChildren(logo)
    //   } catch (err) {
    //     if (!process.env.TEST) {
    //       console.warn('Could not replace logo', err)
    //     }
    //   }
    // }

    // setup
    opts.didOpen = (e: any) => {
      try {

        // prevent return in fake textarea
        e.querySelectorAll('.text-textarea').forEach((el: HTMLInputElement) => {
          el.addEventListener('keydown', (ev: KeyboardEvent) => {
            if (ev.key === 'Enter') {
              ev.preventDefault()
              e.querySelector('.swal2-confirm')?.click()
            }
          })
        })

        // focus 1st input
        const input = e.querySelector('textarea') ?? e.querySelector('input')
        if (input) {
          input.focus()
          input.select()
          input.scrollTo(0, 0)
        }

      } catch { /* empty */ }
    }

    // now do it
    return Swal.fire(opts)
  },

  waitUntilClosed: async (): Promise<void> => {
    while (true) {
      if (!Swal.isVisible()) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

}

export default Dialog
