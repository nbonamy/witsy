
export default {

  /* v8 ignore start */
  resize(src: string, maxSize: number, callback: (contents: string, mimeType: string) => void): void {

    const img = document.createElement('img')
    img.addEventListener('load', () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (img.width > img.height) {
        canvas.width = maxSize
        canvas.height = maxSize * img.height / img.width
      } else {
        canvas.height = maxSize
        canvas.width = maxSize * img.width / img.height
      }
      console.log(`Image resized to ${canvas.width}x${canvas.height}`)
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataURI = canvas.toDataURL('image/jpeg', 0.95);
      callback(dataURI.split(',')[1], 'image/jpeg')
    })
    img.src = src
  
  }
  /* v8 ignore stop */

}
