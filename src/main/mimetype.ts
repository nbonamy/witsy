
export function mimeTypeToExtension(mimeType: string): string {

  console.log('mimeTypeToExtension', mimeType)
  switch (mimeType) {
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx'
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return 'pptx'
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx'
    case 'text/plain':
      return 'txt'
    default:
      // will support pdf (application/pdf)
      return mimeType.split('/')[1]
  }
}
