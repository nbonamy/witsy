export interface PdfExportOptions {
  title: string
  element: HTMLElement
  margin?: number[]
  pagebreak?: { mode: string }
  image?: { type: string, quality: number }
  html2canvas?: { scale?: number, onclone?: (doc: Document) => void }
  jsPDF?: any
  landscape?: boolean
}

const kExportElementIdAttribute = 'data-pdf-export-id'

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const normalizeTitleForMatch = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

export const stripLeadingBodyTitle = (body: HTMLElement, title: string): void => {
  const normalizedTitle = normalizeTitleForMatch(title)
  if (!normalizedTitle.length) return

  const bodyText = normalizeTitleForMatch(body.textContent || '')
  if (!bodyText.startsWith(normalizedTitle)) return

  const firstHeadingOrParagraph = body.querySelector('h1, h2, h3, h4, h5, h6, p')
  if (!firstHeadingOrParagraph) return

  const firstText = normalizeTitleForMatch(firstHeadingOrParagraph.textContent || '')
  if (firstText !== normalizedTitle) return

  const parent = firstHeadingOrParagraph.parentElement
  firstHeadingOrParagraph.remove()
  if (parent && parent !== body && parent.childElementCount === 0 && !(parent.textContent || '').trim().length) {
    parent.remove()
  }
}

const getLightThemeVariables = (): Map<string, string> => {
  const variables = new Map<string, string>()

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }

    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue
      if (!rule.selectorText.includes(':root')) continue
      for (const propertyName of Array.from(rule.style)) {
        if (propertyName.startsWith('--')) {
          variables.set(propertyName, rule.style.getPropertyValue(propertyName))
        }
      }
    }
  }

  return variables
}

const getStylesheetText = (): string => {
  let css = ''

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(rules)) {
      css += `${rule.cssText}\n`
    }
  }

  return css
}

const buildRootVariablesCss = (variables: Map<string, string>): string => {
  const declarations = Array.from(variables.entries())
    .map(([name, value]) => `${name}: ${value};`)
    .join('\n')
  return `:root {\n${declarations}\n}\nhtml { color-scheme: light; }`
}

const getPrintStyle = (): string => {
  return `
@page {
  size: A4;
  margin: 14mm;
}

html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}

body {
  color: #1f2937;
  font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.55;
}

.witsy-pdf-document {
  margin: 0 auto;
}

.witsy-pdf-header {
  border-bottom: 1px solid #d1d5db;
  margin: 0 0 3mm 0;
  padding: 0 0 6mm 0;
}

.witsy-pdf-title {
  margin: 0;
  font-size: 18pt;
  line-height: 1.25;
  font-weight: 700;
  color: #111827;
}

.witsy-pdf-content .messages {
  margin-left: 0 !important;
  margin-right: 0 !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.witsy-pdf-content .messages .message {
  margin-top: 1rem !important;
}

.witsy-pdf-content .messages .message-body {
  margin-left: 2rem !important;
  margin-right: 0rem !important;
  padding-left: 0rem !important;
  padding-right: 0rem !important;
}

.witsy-pdf-content .messages .message-body .toggle-reasoning {
  display: none !important;
}

.witsy-pdf-content .messages .message-actions {
  display: none !important;
}

.witsy-pdf-content h1,
.witsy-pdf-content h2,
.witsy-pdf-content h3,
.witsy-pdf-content h4 {
  color: #111827;
  break-after: avoid-page;
}

.witsy-pdf-content h1 { font-size: 17pt; margin: 0 0 4mm 0; }
.witsy-pdf-content h2 { font-size: 14pt; margin: 9mm 0 3mm 0; }
.witsy-pdf-content h3 { font-size: 12pt; margin: 7mm 0 2mm 0; }
.witsy-pdf-content h4 { font-size: 11pt; margin: 6mm 0 2mm 0; }

.witsy-pdf-content p,
.witsy-pdf-content li {
  color: #1f2937;
  overflow-wrap: anywhere;
  word-break: normal;
}

.witsy-pdf-content p { margin: 0 0 4mm 0; }
.witsy-pdf-content ul,
.witsy-pdf-content ol { margin: 0 0 5mm 6mm; padding-left: 6mm; }
.witsy-pdf-content li { margin: 0 0 1.8mm 0; }

.witsy-pdf-content pre,
.witsy-pdf-content code {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace;
}

.witsy-pdf-content pre {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 3mm;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}

.witsy-pdf-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 6mm 0;
}

.witsy-pdf-content th,
.witsy-pdf-content td {
  border: 1px solid #d1d5db;
  padding: 2mm 2.5mm 2mm 4mm !important;
  vertical-align: top;
  overflow-wrap: anywhere;
}

.witsy-pdf-content a {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.witsy-pdf-content th {
  text-align: left;
}

.witsy-pdf-content blockquote {
  margin: 0 0 5mm 0;
  padding: 0 0 0 4mm;
  border-left: 2.5px solid #d1d5db;
  color: #374151;
}

.witsy-pdf-content img,
.witsy-pdf-content canvas,
.witsy-pdf-content svg {
  max-width: 100% !important;
  height: auto !important;
}

.witsy-pdf-content .avatar,
.witsy-pdf-content .avatar img,
.witsy-pdf-content .avatar svg {
  width: 4mm !important;
  height: 4mm !important;
  min-width: 4mm !important;
  min-height: 4mm !important;
}

.witsy-pdf-content .actions,
.witsy-pdf-content .prompt,
.witsy-pdf-content .overflow,
.witsy-pdf-content .tool-container,
.witsy-pdf-content .menu,
.witsy-pdf-content .icon {
  display: none !important;
}
`
}

const buildPrintDocument = (title: string, content: HTMLElement): string => {
  const stylesheetText = getStylesheetText()
  const rootVars = buildRootVariablesCss(getLightThemeVariables())
  const printStyle = getPrintStyle()
  const safeTitle = escapeHtml(title || 'Export')
  const isHtmlDocument = content.tagName.toLowerCase() === 'html'
  const headHtml = isHtmlDocument ? (content.querySelector('head')?.innerHTML || '') : ''
  const bodyHtml = isHtmlDocument
    ? (content.querySelector('body')?.innerHTML || '')
    : content.outerHTML
  const isEditorProfile = content.getAttribute('data-pdf-profile') === 'editor'
  const documentProfileClass = isEditorProfile ? ' profile-editor' : ''
  const editorProfileStyle = isEditorProfile
    ? `
.witsy-pdf-document.profile-editor .witsy-pdf-content,
.witsy-pdf-document.profile-editor .witsy-pdf-content p,
.witsy-pdf-document.profile-editor .witsy-pdf-content li,
.witsy-pdf-document.profile-editor .witsy-pdf-content td,
.witsy-pdf-document.profile-editor .witsy-pdf-content th,
.witsy-pdf-document.profile-editor .witsy-pdf-content blockquote {
  font-size: 12.5pt !important;
  line-height: 1.54 !important;
}

.witsy-pdf-document.profile-editor .witsy-pdf-content code,
.witsy-pdf-document.profile-editor .witsy-pdf-content pre {
  font-size: 11.5pt !important;
  line-height: 1.45 !important;
}

.witsy-pdf-document.profile-editor .witsy-pdf-content h1 { font-size: 19pt !important; }
.witsy-pdf-document.profile-editor .witsy-pdf-content h2 { font-size: 16.5pt !important; }
.witsy-pdf-document.profile-editor .witsy-pdf-content h3 { font-size: 14.5pt !important; }
.witsy-pdf-document.profile-editor .witsy-pdf-content h4 { font-size: 12.5pt !important; }
`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safeTitle}</title>
${headHtml}
<style>${stylesheetText}</style>
<style>${rootVars}</style>
<style>${printStyle}</style>
<style>${editorProfileStyle}</style>
</head>
<body>
  <article class="witsy-pdf-document${documentProfileClass}">
    <header class="witsy-pdf-header">
      <h1 class="witsy-pdf-title">${safeTitle}</h1>
    </header>
    <section class="witsy-pdf-content">
      ${bodyHtml}
    </section>
  </article>
</body>
</html>`
}

const enrichContentForPdf = async (element: HTMLElement): Promise<HTMLElement> => {
  const sources = element.querySelectorAll<HTMLElement>('img, canvas')
  for (let i=0; i<sources.length; i++) {
    sources[i].setAttribute(kExportElementIdAttribute, crypto.randomUUID())
  }

  const content = element.cloneNode(true) as HTMLElement

  await Promise.all(
    Array.from(content.querySelectorAll<HTMLImageElement>('img')).map(async (img) => {
      const id = img.getAttribute(kExportElementIdAttribute)
      if (!id) return
      const source = element.querySelector<HTMLImageElement>(`img[${kExportElementIdAttribute}="${id}"]`)
      const src = source?.src
      if (!src) return

      if (src.startsWith('file://')) {
        const path = decodeURIComponent(src.replace('file://', ''))
        const data = window.api.file.read(path)
        if (data?.contents) {
          img.src = `data:${data.mimeType};base64,${data.contents}`
        }
      } else if (src.startsWith('http')) {
        const response = await fetch(src)
        const blob = await response.blob()
        await new Promise<void>((resolve) => {
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

  content.querySelectorAll<HTMLCanvasElement>('canvas').forEach((canvas) => {
    try {
      const id = canvas.getAttribute(kExportElementIdAttribute)
      if (!id) return
      const source = element.querySelector<HTMLCanvasElement>(`canvas[${kExportElementIdAttribute}="${id}"]`)
      if (!source) return
      const image = document.createElement('img')
      image.src = source.toDataURL('image/png')
      image.style.cssText = canvas.style.cssText
      if (!image.style.width) image.style.width = `${canvas.width}px`
      if (!image.style.height) image.style.height = `${canvas.height}px`
      canvas.parentNode?.replaceChild(image, canvas)
    } catch (error) {
      console.warn('Could not convert canvas to image:', error)
    }
  })

  return content
}

export const exportToPdf = async (options: PdfExportOptions): Promise<void> => {
  const { title, element, landscape = false } = options
  const cleanTitle = (title || 'export').trim()
  const filename = `${cleanTitle.replace(/\.[^.]+$/, '') || 'export'}.pdf`

  try {
    const content = await enrichContentForPdf(element)
    const html = buildPrintDocument(cleanTitle, content)
    const base64Pdf = await window.api.app.printToPdf(html, landscape)

    window.api.file.save({
      contents: base64Pdf,
      properties: {
        filename,
        prompt: true
      }
    })
  } catch (error) {
    console.error('Error exporting PDF:', error)
    throw error
  } finally {
    element.querySelectorAll(`[${kExportElementIdAttribute}]`).forEach((node) => {
      node.removeAttribute(kExportElementIdAttribute)
    })
  }
}
