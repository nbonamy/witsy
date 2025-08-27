
import Swal, { DialogResult as SwalDialogResult } from 'sweetalert2/dist/sweetalert2.js'
import { convert } from 'html-to-text'
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

  show: async (opts: DialogOptions): Promise<DialogResult|typeof SwalDialogResult> => {

    // check if there is already one open
    if (Swal.isVisible()) {

      // let's try to wait
      await new Promise((resolve) => setTimeout(resolve, 250));
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
    opts.iconHtml = opts.iconHtml ?? '<img src="">'

    // add custom classes
    opts.customClass = {
      popup: 'form form-large',
      confirmButton: opts.showCancelButton ? 'alert-confirm' : 'alert-neutral',
      cancelButton: 'alert-neutral',
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

    // setup
    opts.willOpen = (e: any) => {
      try {
        // this is not very nice but don't want to go through the hassle
        // of getting base64 from file through preload and all of this!
        // also tried with a hardcoded base64 but it was ugly
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

        // add clipboard copy functionality
        setupClipboardCopy(e, opts)

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

const setupClipboardCopy = (dialogElement: any, opts: DialogOptions) => {
  
  const handleCopyToClipboard = (ev: KeyboardEvent) => {
  
    const isMac = window.api.platform === 'darwin'
    const copyKeyPressed = isMac ? ev.metaKey && ev.key === 'c' : ev.ctrlKey && ev.key === 'c'
    
    if (copyKeyPressed) {
      // Don't interfere if user is selecting text in an input
      const activeElement = document.activeElement
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        const selection = window.getSelection()?.toString()
        if (selection && selection.length > 0) {
          return // Let default copy behavior handle selected text
        }
      }

      ev.preventDefault()
      
      // Get dialog content
      const title = dialogElement.querySelector('.swal2-title')?.textContent || ''
      const htmlContent = dialogElement.querySelector('.swal2-html-container')?.innerHTML || 
                         dialogElement.querySelector('.swal2-content')?.innerHTML || ''
      
      // Convert HTML to plain text if we have HTML content, otherwise use the text option
      const content = htmlContent ? convert(htmlContent, {
        wordwrap: false,
        preserveNewlines: true,
        selectors: [
          { selector: 'img', format: 'skip' },
          { selector: 'p', format: 'paragraph', options: { leadingLineBreaks: 2, trailingLineBreaks: 2 } },
          { selector: 'div', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 2 } },
          { selector: 'br', format: 'lineBreak' },
          { selector: 'ul > *', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 2 } },
          { selector: 'ol > *', format: 'block', options: { leadingLineBreaks: 1, trailingLineBreaks: 2 } }
        ]
      }) : (opts.text || '')
      
      // Combine title and content
      let dialogContent = ''
      if (title) {
        dialogContent = title
        if (content) {
          dialogContent += '\n\n' + content
        }
      } else if (content) {
        dialogContent = content
      }
      
      // Copy to clipboard
      navigator.clipboard.writeText(dialogContent).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = dialogContent
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      })
    }
  }

  // Add event listener to the dialog
  dialogElement.addEventListener('keydown', handleCopyToClipboard)
  
  // Store the original didClose callback if it exists
  const originalDidClose = opts.didClose
  
  // Set up cleanup on dialog close
  opts.didClose = (popup: any) => {
    // Remove the event listener to prevent memory leaks
    dialogElement.removeEventListener('keydown', handleCopyToClipboard)
    
    // Call the original didClose callback if it existed
    if (originalDidClose) {
      return originalDidClose(popup)
    }
  }
}

export default Dialog
