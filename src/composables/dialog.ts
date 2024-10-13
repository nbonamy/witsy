
import Swal from 'sweetalert2/dist/sweetalert2.js'



export default {

  show: (opts: any): Promise<any> => {

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
      const icon: Element =  e.querySelector('.swal2-icon .swal2-icon-content')
      const logo: Element = document.querySelector('#logo').cloneNode() as Element
      logo.removeAttribute('id')
      logo.removeAttribute('style')
      icon?.replaceChildren(logo)
    }

    // now do it
    return Swal.fire(opts)
  },

}
