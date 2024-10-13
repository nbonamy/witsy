
import Swal, { SweetAlertResult } from 'sweetalert2/dist/sweetalert2.js'

export default {

  show: (opts: any): Promise<SweetAlertResult> => {
    return Swal.fire({
      iconHtml: '<img src="/assets/icon.png">',
      ...opts
    })
  },

}
