import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import PptxGenJS from 'pptxgenjs'
import { saveBlobAsFile } from './download'

export interface PptxExportOptions {
  title: string
  content: string
  author?: string
  isMarp?: boolean
}

interface SlideContent {
  title: string
  bullets: string[]
  codeBlocks: { code: string; language: string }[]
  tables: string[][][]
}

// Initialize markdown-it for parsing
const md = new MarkdownIt({
  html: false,
  breaks: true,
})

/**
 * Export markdown content to a PPTX file
 */
export const exportToPptx = async (options: PptxExportOptions): Promise<Blob> => {
  const { title, content, author, isMarp } = options

  // Create presentation
  const pptx = new PptxGenJS()
  pptx.author = author || 'StationOne'
  pptx.title = title
  pptx.subject = title

  // Parse content into slides
  const slides = isMarp ? parseMarpContent(content) : parseMarkdownContent(content, title)

  // If no slides were created, add a single slide with all content
  if (slides.length === 0) {
    slides.push({
      title: title,
      bullets: content.split('\n').filter((line) => line.trim()),
      codeBlocks: [],
      tables: [],
    })
  }

  // Generate slides
  for (const slideContent of slides) {
    addSlide(pptx, slideContent)
  }

  // Generate blob
  const data = await pptx.write({ outputType: 'blob' })
  return data as Blob
}

/**
 * Parse Marp content (slides separated by ---)
 */
function parseMarpContent(content: string): SlideContent[] {
  // Remove frontmatter if present
  let processedContent = content
  const frontmatterMatch = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?/)
  if (frontmatterMatch) {
    processedContent = content.slice(frontmatterMatch[0].length)
  }

  // Split by slide separator
  const slideTexts = processedContent.split(/\n---\s*\n/)

  return slideTexts
    .map((slideText) => parseSlideContent(slideText.trim()))
    .filter((slide) => slide.title || slide.bullets.length > 0)
}

/**
 * Parse regular markdown content (split by H1 or H2 headings)
 */
function parseMarkdownContent(content: string, documentTitle: string): SlideContent[] {
  const tokens = md.parse(content, {})
  const slides: SlideContent[] = []
  let currentSlide: SlideContent | null = null
  let isFirstHeading = true

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]

    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.slice(1))

      // Get heading text
      const contentToken = tokens[i + 1]
      const headingText = contentToken?.type === 'inline' ? contentToken.content : ''

      // H1 or H2 starts a new slide
      if (level <= 2) {
        if (currentSlide) {
          slides.push(currentSlide)
        }
        currentSlide = {
          title: headingText,
          bullets: [],
          codeBlocks: [],
          tables: [],
        }
        isFirstHeading = false
      } else if (currentSlide) {
        // H3+ becomes a bullet point with emphasis
        currentSlide.bullets.push(`**${headingText}**`)
      }

      i += 3 // Skip heading_open, inline, heading_close
      continue
    }

    // If no slide yet, create one with document title
    if (!currentSlide && isFirstHeading) {
      currentSlide = {
        title: documentTitle,
        bullets: [],
        codeBlocks: [],
        tables: [],
      }
      isFirstHeading = false
    }

    if (!currentSlide) {
      i++
      continue
    }

    switch (token.type) {
      case 'paragraph_open': {
        const contentToken = tokens[i + 1]
        if (contentToken?.type === 'inline') {
          const text = contentToken.content.trim()
          if (text) {
            currentSlide.bullets.push(text)
          }
        }
        i += 3 // Skip paragraph_open, inline, paragraph_close
        break
      }

      case 'bullet_list_open':
      case 'ordered_list_open': {
        const listResult = parseListItems(tokens, i)
        currentSlide.bullets.push(...listResult.items)
        i = listResult.endIndex + 1
        break
      }

      case 'fence':
      case 'code_block': {
        currentSlide.codeBlocks.push({
          code: token.content.replace(/\n$/, ''),
          language: token.info || '',
        })
        i++
        break
      }

      case 'table_open': {
        const tableResult = parseTableContent(tokens, i)
        currentSlide.tables.push(tableResult.rows)
        i = tableResult.endIndex + 1
        break
      }

      default:
        i++
    }
  }

  // Push the last slide
  if (currentSlide) {
    slides.push(currentSlide)
  }

  return slides
}

/**
 * Parse a single slide's text content
 */
function parseSlideContent(slideText: string): SlideContent {
  const tokens = md.parse(slideText, {})
  const slide: SlideContent = {
    title: '',
    bullets: [],
    codeBlocks: [],
    tables: [],
  }

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]

    if (token.type === 'heading_open') {
      const contentToken = tokens[i + 1]
      const headingText = contentToken?.type === 'inline' ? contentToken.content : ''
      const level = parseInt(token.tag.slice(1))

      if (level === 1 && !slide.title) {
        slide.title = headingText
      } else if (level <= 2 && !slide.title) {
        slide.title = headingText
      } else {
        // Sub-headings become bold bullets
        slide.bullets.push(`**${headingText}**`)
      }

      i += 3
      continue
    }

    switch (token.type) {
      case 'paragraph_open': {
        const contentToken = tokens[i + 1]
        if (contentToken?.type === 'inline') {
          const text = contentToken.content.trim()
          if (text) {
            slide.bullets.push(text)
          }
        }
        i += 3
        break
      }

      case 'bullet_list_open':
      case 'ordered_list_open': {
        const listResult = parseListItems(tokens, i)
        slide.bullets.push(...listResult.items)
        i = listResult.endIndex + 1
        break
      }

      case 'fence':
      case 'code_block': {
        slide.codeBlocks.push({
          code: token.content.replace(/\n$/, ''),
          language: token.info || '',
        })
        i++
        break
      }

      case 'table_open': {
        const tableResult = parseTableContent(tokens, i)
        slide.tables.push(tableResult.rows)
        i = tableResult.endIndex + 1
        break
      }

      default:
        i++
    }
  }

  return slide
}

/**
 * Parse list items from tokens
 */
function parseListItems(
  tokens: Token[],
  startIndex: number,
  prefix: string = ''
): { items: string[]; endIndex: number } {
  const items: string[] = []
  let i = startIndex + 1
  const isOrdered = tokens[startIndex].type === 'ordered_list_open'
  let itemNumber = 1

  while (i < tokens.length) {
    const token = tokens[i]

    if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') {
      return { items, endIndex: i }
    }

    if (token.type === 'list_item_open') {
      i++
      while (i < tokens.length && tokens[i].type !== 'list_item_close') {
        const itemToken = tokens[i]

        if (itemToken.type === 'paragraph_open') {
          const contentToken = tokens[i + 1]
          if (contentToken?.type === 'inline') {
            const marker = isOrdered ? `${itemNumber}. ` : ''
            items.push(`${prefix}${marker}${contentToken.content}`)
            itemNumber++
          }
          i += 3
        } else if (itemToken.type === 'bullet_list_open' || itemToken.type === 'ordered_list_open') {
          // Nested list - add indentation
          const nestedResult = parseListItems(tokens, i, prefix + '    ')
          items.push(...nestedResult.items)
          i = nestedResult.endIndex + 1
        } else {
          i++
        }
      }
    }

    i++
  }

  return { items, endIndex: i }
}

/**
 * Parse table content from tokens
 */
function parseTableContent(tokens: Token[], startIndex: number): { rows: string[][]; endIndex: number } {
  const rows: string[][] = []
  let i = startIndex + 1

  while (i < tokens.length) {
    const token = tokens[i]

    if (token.type === 'table_close') {
      break
    }

    if (token.type === 'tr_open') {
      const row: string[] = []
      i++

      while (i < tokens.length && tokens[i].type !== 'tr_close') {
        if (tokens[i].type === 'th_open' || tokens[i].type === 'td_open') {
          i++
          while (i < tokens.length && tokens[i].type !== 'th_close' && tokens[i].type !== 'td_close') {
            if (tokens[i].type === 'inline') {
              row.push(tokens[i].content)
            }
            i++
          }
        }
        i++
      }

      if (row.length > 0) {
        rows.push(row)
      }
    }

    i++
  }

  return { rows, endIndex: i }
}

/**
 * Add a slide to the presentation
 */
function addSlide(pptx: PptxGenJS, content: SlideContent): void {
  const slide = pptx.addSlide()

  // Add title
  if (content.title) {
    slide.addText(stripMarkdown(content.title), {
      x: 0.5,
      y: 0.5,
      w: '90%',
      h: 0.75,
      fontSize: 28,
      bold: true,
      color: '333333',
    })
  }

  let yPosition = content.title ? 1.5 : 0.5

  // Add bullets
  if (content.bullets.length > 0) {
    const bulletTexts = content.bullets.map((bullet) => {
      const isBold = bullet.startsWith('**') && bullet.endsWith('**')
      const text = stripMarkdown(bullet)
      return {
        text,
        options: {
          bullet: !bullet.startsWith('    '),
          indentLevel: bullet.startsWith('    ') ? 1 : 0,
          bold: isBold,
        },
      }
    })

    slide.addText(bulletTexts, {
      x: 0.5,
      y: yPosition,
      w: '90%',
      h: 4,
      fontSize: 18,
      color: '444444',
      valign: 'top',
    })

    yPosition += Math.min(content.bullets.length * 0.4, 4)
  }

  // Add code blocks
  for (const codeBlock of content.codeBlocks) {
    if (yPosition > 6) break // Don't overflow slide

    slide.addText(codeBlock.code, {
      x: 0.5,
      y: yPosition,
      w: '90%',
      h: Math.min(codeBlock.code.split('\n').length * 0.25 + 0.5, 3),
      fontSize: 10,
      fontFace: 'Courier New',
      fill: { color: 'F5F5F5' },
      color: '333333',
      valign: 'top',
    })

    yPosition += Math.min(codeBlock.code.split('\n').length * 0.25 + 0.7, 3.2)
  }

  // Add tables
  for (const tableRows of content.tables) {
    if (yPosition > 5 || tableRows.length === 0) break

    const tableData: PptxGenJS.TableRow[] = tableRows.map((row, rowIndex) => {
      return row.map((cell) => ({
        text: cell,
        options: {
          bold: rowIndex === 0,
          fill: rowIndex === 0 ? { color: 'E0E0E0' } : undefined,
        },
      }))
    })

    slide.addTable(tableData, {
      x: 0.5,
      y: yPosition,
      w: 9,
      fontSize: 12,
      color: '333333',
      border: { pt: 1, color: 'CCCCCC' },
    })

    yPosition += tableRows.length * 0.4 + 0.5
  }
}

/**
 * Strip markdown formatting from text
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1') // Italic
    .replace(/~~(.*?)~~/g, '$1') // Strikethrough
    .replace(/`(.*?)`/g, '$1') // Inline code
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
    .replace(/!\[(.*?)\]\(.*?\)/g, '[$1]') // Images
}

/**
 * Download blob as a PPTX file
 */
export const savePptxBlob = (blob: Blob, filename: string): void => {
  saveBlobAsFile(blob, filename, 'pptx')
}
