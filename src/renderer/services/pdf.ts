import html2canvas from 'html2canvas-pro'
import html2pdf from 'html2pdf.js'
import { store } from './store'

export interface PdfExportOptions {
  title: string
  element: HTMLElement
  margin?: number[]
  pagebreak?: { mode: string }
  image?: { type: string, quality: number }
  html2canvas?: { scale: number }
  jsPDF?: any
}

export const exportToPdf = async (options: PdfExportOptions): Promise<void> => {
  const {
    title,
    element,
    margin = [12, 4, 8, 4],
    pagebreak = { mode: 'avoid-all' },
    image = { type: 'jpeg', quality: 1.0 },
    html2canvas: html2canvasOptions = { scale: 2 },
    jsPDF = { compress: true, putOnlyUsedFonts: true }
  } = options

  const theme = store.config.appearance.theme
  const screenshotImage = document.createElement('img')

  try {
    // Take a screenshot to hide theme flickering from user
    const canvas = await html2canvas(document.documentElement)

    // Add screenshot overlay
    screenshotImage.style.position = 'absolute'
    screenshotImage.style.top = '0'
    screenshotImage.style.left = '0'
    screenshotImage.style.width = '100%'
    screenshotImage.style.zIndex = '10000'
    screenshotImage.src = canvas.toDataURL()
    document.body.appendChild(screenshotImage)

    // Switch to light theme for better PDF rendering
    window.api.app.setAppearanceTheme('light')

    // tag images and canvases
    const images = element.querySelectorAll<HTMLElement>('img, canvas')
    for (let i=0; i<images.length; i++) {
      const image = images[i]
      image.setAttribute('data-uuid', crypto.randomUUID())
    }

    // Clone and prepare the element for PDF generation
    const content = element.cloneNode(true) as HTMLElement
    
    // Replace file:// images with base64 data
    await Promise.all(
      Array.from(content.querySelectorAll<HTMLImageElement>('img')).map(async (img) => {
        const uuid = img.getAttribute('data-uuid')
        const src = element.querySelector<HTMLImageElement>(`img[data-uuid="${uuid}"]`).src
        if (src.startsWith('file://')) {
          const path = decodeURIComponent(src.replace('file://', ''))
          const data = window.api.file.read(path)
          if (data) {
            img.src = `data:${data.mimeType};base64,${data.contents}`
          }
        } else if (src.startsWith('http')) {
          const response = await fetch(src)
          const blob = await response.blob()
          return new Promise<void>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => {
              img.src = reader.result as string
              resolve()
            }
            reader.readAsDataURL(blob)
          })
        }
      })
    )

    // Replace canvas elements with their base64 image data
    content.querySelectorAll<HTMLCanvasElement>('canvas').forEach((canvas) => {
      try {
        const uuid = canvas.getAttribute('data-uuid')
        const orig = element.querySelector<HTMLCanvasElement>(`canvas[data-uuid="${uuid}"]`)
        const dataURL = orig.toDataURL('image/png')
        const img = document.createElement('img')
        img.src = dataURL
        img.style.width = canvas.style.width || `${canvas.width}px`
        img.style.height = canvas.style.height || `${canvas.height}px`
        // Copy any other relevant styles
        if (canvas.style.cssText) {
          img.style.cssText = canvas.style.cssText
        }
        canvas.parentNode?.replaceChild(img, canvas)
      } catch (error) {
        console.warn('Could not convert canvas to image:', error)
      }
    })

    // Configure PDF generation options
    const pdfOptions = {
      margin,
      filename: `${title}.pdf`,
      image,
      html2canvas: html2canvasOptions,
      pagebreak,
      jsPDF
    }

    // Generate and save PDF
    await html2pdf().from(content).set(pdfOptions as any).save()

  } catch (error) {
    console.error('Error exporting PDF:', error)
    throw error
  } finally {
    // Restore original theme
    window.api.app.setAppearanceTheme(theme)

    // Remove screenshot overlay after a delay
    setTimeout(() => {
      if (screenshotImage.parentNode) {
        document.body.removeChild(screenshotImage)
      }
    }, 500)
  }
}
