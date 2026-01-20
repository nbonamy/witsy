import {
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { saveBlobAsFile } from './download'

// Style constants
const FONT_FAMILY = 'Calibri'
const FONT_FAMILY_CODE = 'Courier New'

// Font sizes in half-points (1pt = 2 half-points)
const FONT_SIZE = {
  BODY: 22, // 11pt
  H1: 48, // 24pt
  H2: 36, // 18pt
  H3: 28, // 14pt
  H4: 24, // 12pt
  CODE: 18, // 9pt
  CODE_INLINE: 20, // 10pt
}

// Spacing in twips (1pt = 20 twips)
const SPACING = {
  H1_BEFORE: 480, // 24pt
  H1_AFTER: 240, // 12pt
  H2_BEFORE: 360, // 18pt
  H2_AFTER: 160, // 8pt
  H3_BEFORE: 280, // 14pt
  H3_AFTER: 120, // 6pt
  H4_BEFORE: 240, // 12pt
  H4_AFTER: 80, // 4pt
  PARAGRAPH_AFTER: 160, // 8pt
  LIST_ITEM_AFTER: 60, // 3pt
  CODE_BLOCK_BEFORE: 200, // 10pt
  CODE_BLOCK_AFTER: 200, // 10pt
  BLOCKQUOTE_BEFORE: 200, // 10pt
  BLOCKQUOTE_AFTER: 200, // 10pt
}

// Line spacing (percentage, 115 = 1.15 line spacing)
const LINE_SPACING = 276 // 1.15 in 240ths of a line

export interface DocxExportOptions {
  title: string
  content: string
  author?: string
}

interface TextStyle {
  bold?: boolean
  italic?: boolean
  strike?: boolean
  code?: boolean
}

interface ParsedLink {
  text: string
  href: string
}

// Initialize markdown-it for parsing
const md = new MarkdownIt({
  html: false,
  breaks: true,
})

/**
 * Export markdown content to a DOCX file
 */
export const exportToDocx = async (options: DocxExportOptions): Promise<Blob> => {
  const { title, content, author } = options

  // Parse markdown to tokens
  const tokens = md.parse(content, {})

  // Convert tokens to DOCX paragraphs
  const children = await tokensToDocxElements(tokens)

  // Create document with custom styles
  const doc = new Document({
    creator: author || 'Witsy',
    title: title,
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: FONT_SIZE.BODY,
          },
          paragraph: {
            spacing: {
              after: SPACING.PARAGRAPH_AFTER,
              line: LINE_SPACING,
            },
          },
        },
        heading1: {
          run: {
            font: FONT_FAMILY,
            size: FONT_SIZE.H1,
            bold: true,
          },
          paragraph: {
            spacing: {
              before: SPACING.H1_BEFORE,
              after: SPACING.H1_AFTER,
            },
          },
        },
        heading2: {
          run: {
            font: FONT_FAMILY,
            size: FONT_SIZE.H2,
            bold: true,
          },
          paragraph: {
            spacing: {
              before: SPACING.H2_BEFORE,
              after: SPACING.H2_AFTER,
            },
          },
        },
        heading3: {
          run: {
            font: FONT_FAMILY,
            size: FONT_SIZE.H3,
            bold: true,
          },
          paragraph: {
            spacing: {
              before: SPACING.H3_BEFORE,
              after: SPACING.H3_AFTER,
            },
          },
        },
        heading4: {
          run: {
            font: FONT_FAMILY,
            size: FONT_SIZE.H4,
            bold: true,
          },
          paragraph: {
            spacing: {
              before: SPACING.H4_BEFORE,
              after: SPACING.H4_AFTER,
            },
          },
        },
        heading5: {
          run: {
            font: FONT_FAMILY,
            size: FONT_SIZE.H4,
            bold: true,
          },
          paragraph: {
            spacing: {
              before: SPACING.H4_BEFORE,
              after: SPACING.H4_AFTER,
            },
          },
        },
        heading6: {
          run: {
            font: FONT_FAMILY,
            size: FONT_SIZE.H4,
            bold: true,
          },
          paragraph: {
            spacing: {
              before: SPACING.H4_BEFORE,
              after: SPACING.H4_AFTER,
            },
          },
        },
      },
    },
    sections: [
      {
        children,
      },
    ],
  })

  // Generate blob
  const blob = await Packer.toBlob(doc)
  return blob
}

/**
 * Convert markdown-it tokens to DOCX elements
 */
async function tokensToDocxElements(tokens: Token[]): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = []
  let i = 0

  while (i < tokens.length) {
    const token = tokens[i]

    switch (token.type) {
      case 'heading_open': {
        const level = parseInt(token.tag.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6
        const contentToken = tokens[i + 1]
        if (contentToken && contentToken.type === 'inline') {
          const runs = parseInlineContent(contentToken.children || [], contentToken.content)
          elements.push(
            new Paragraph({
              heading: getHeadingLevel(level),
              children: runs,
            })
          )
        }
        i += 3 // Skip heading_open, inline, heading_close
        break
      }

      case 'paragraph_open': {
        const contentToken = tokens[i + 1]
        if (contentToken && contentToken.type === 'inline') {
          const runs = parseInlineContent(contentToken.children || [], contentToken.content)
          elements.push(
            new Paragraph({
              children: runs,
            })
          )
        }
        i += 3 // Skip paragraph_open, inline, paragraph_close
        break
      }

      case 'bullet_list_open':
      case 'ordered_list_open': {
        const isOrdered = token.type === 'ordered_list_open'
        const listElements = parseList(tokens, i, isOrdered)
        elements.push(...listElements.elements)
        i = listElements.endIndex + 1
        break
      }

      case 'blockquote_open': {
        const blockquoteElements = parseBlockquote(tokens, i)
        elements.push(...blockquoteElements.elements)
        i = blockquoteElements.endIndex + 1
        break
      }

      case 'fence':
      case 'code_block': {
        const codeContent = token.content.replace(/\n$/, '')
        const lines = codeContent.split('\n')
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex]
          const isFirst = lineIndex === 0
          const isLast = lineIndex === lines.length - 1
          elements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line || ' ',
                  font: FONT_FAMILY_CODE,
                  size: FONT_SIZE.CODE,
                }),
              ],
              shading: {
                fill: 'F5F5F5',
              },
              spacing: {
                before: isFirst ? SPACING.CODE_BLOCK_BEFORE : 0,
                after: isLast ? SPACING.CODE_BLOCK_AFTER : 0,
                line: 240, // Single line spacing for code
              },
            })
          )
        }
        i++
        break
      }

      case 'hr': {
        elements.push(
          new Paragraph({
            border: {
              bottom: {
                color: 'CCCCCC',
                space: 1,
                size: 6,
                style: BorderStyle.SINGLE,
              },
            },
          })
        )
        i++
        break
      }

      case 'table_open': {
        const tableResult = parseTable(tokens, i)
        elements.push(tableResult.table)
        i = tableResult.endIndex + 1
        break
      }

      default:
        i++
    }
  }

  return elements
}

/**
 * Parse inline content (text with formatting)
 */
function parseInlineContent(children: Token[], fallbackContent: string): (TextRun | ExternalHyperlink)[] {
  if (!children || children.length === 0) {
    return [new TextRun({ text: fallbackContent })]
  }

  const runs: (TextRun | ExternalHyperlink)[] = []
  const styleStack: TextStyle = {}
  let currentLink: ParsedLink | null = null

  for (const child of children) {
    switch (child.type) {
      case 'text':
        if (currentLink) {
          runs.push(
            new ExternalHyperlink({
              link: currentLink.href,
              children: [
                new TextRun({
                  text: child.content,
                  style: 'Hyperlink',
                  ...getTextRunOptions(styleStack),
                }),
              ],
            })
          )
        } else {
          runs.push(
            new TextRun({
              text: child.content,
              ...getTextRunOptions(styleStack),
            })
          )
        }
        break

      case 'code_inline':
        runs.push(
          new TextRun({
            text: child.content,
            font: FONT_FAMILY_CODE,
            size: FONT_SIZE.CODE_INLINE,
            shading: {
              fill: 'F5F5F5',
            },
          })
        )
        break

      case 'softbreak':
      case 'hardbreak':
        runs.push(new TextRun({ break: 1 }))
        break

      case 'strong_open':
        styleStack.bold = true
        break
      case 'strong_close':
        styleStack.bold = false
        break

      case 'em_open':
        styleStack.italic = true
        break
      case 'em_close':
        styleStack.italic = false
        break

      case 's_open':
        styleStack.strike = true
        break
      case 's_close':
        styleStack.strike = false
        break

      case 'link_open':
        currentLink = {
          text: '',
          href: child.attrGet('href') || '',
        }
        break
      case 'link_close':
        currentLink = null
        break

      case 'image':
        // For now, add placeholder text for images
        // Full image support would require fetching and embedding
        runs.push(
          new TextRun({
            text: `[Image: ${child.attrGet('alt') || 'image'}]`,
            italics: true,
            color: '666666',
          })
        )
        break
    }
  }

  return runs
}

/**
 * Get TextRun options from style stack
 */
function getTextRunOptions(style: TextStyle): Partial<{ bold: boolean; italics: boolean; strike: boolean }> {
  return {
    bold: style.bold || false,
    italics: style.italic || false,
    strike: style.strike || false,
  }
}

/**
 * Convert heading level number to DOCX HeadingLevel
 */
function getHeadingLevel(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const levels: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  }
  return levels[level] || HeadingLevel.HEADING_1
}

/**
 * Parse a list (bullet or ordered)
 */
function parseList(
  tokens: Token[],
  startIndex: number,
  isOrdered: boolean,
  depth: number = 0
): { elements: Paragraph[]; endIndex: number } {
  const elements: Paragraph[] = []
  let i = startIndex + 1
  let itemNumber = 1

  while (i < tokens.length) {
    const token = tokens[i]

    if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') {
      return { elements, endIndex: i }
    }

    if (token.type === 'list_item_open') {
      i++
      // Process list item content
      while (i < tokens.length && tokens[i].type !== 'list_item_close') {
        const itemToken = tokens[i]

        if (itemToken.type === 'paragraph_open') {
          const contentToken = tokens[i + 1]
          if (contentToken && contentToken.type === 'inline') {
            const runs = parseInlineContent(contentToken.children || [], contentToken.content)
            const bullet = isOrdered ? `${itemNumber}. ` : '• '
            const indent = '    '.repeat(depth)
            elements.push(
              new Paragraph({
                children: [new TextRun({ text: indent + bullet }), ...runs],
                spacing: {
                  after: SPACING.LIST_ITEM_AFTER,
                },
              })
            )
            itemNumber++
          }
          i += 3 // Skip paragraph_open, inline, paragraph_close
        } else if (itemToken.type === 'bullet_list_open' || itemToken.type === 'ordered_list_open') {
          // Nested list
          const nestedResult = parseList(tokens, i, itemToken.type === 'ordered_list_open', depth + 1)
          elements.push(...nestedResult.elements)
          i = nestedResult.endIndex + 1
        } else {
          i++
        }
      }
    }

    i++
  }

  return { elements, endIndex: i }
}

/**
 * Parse a blockquote
 */
function parseBlockquote(tokens: Token[], startIndex: number): { elements: Paragraph[]; endIndex: number } {
  const elements: Paragraph[] = []
  let i = startIndex + 1

  while (i < tokens.length) {
    const token = tokens[i]

    if (token.type === 'blockquote_close') {
      return { elements, endIndex: i }
    }

    if (token.type === 'paragraph_open') {
      const contentToken = tokens[i + 1]
      if (contentToken && contentToken.type === 'inline') {
        const runs = parseInlineContent(contentToken.children || [], contentToken.content)
        const isFirst = elements.length === 0
        elements.push(
          new Paragraph({
            children: runs,
            indent: {
              left: convertInchesToTwip(0.5),
            },
            border: {
              left: {
                color: 'CCCCCC',
                space: 1,
                size: 24,
                style: BorderStyle.SINGLE,
              },
            },
            spacing: {
              before: isFirst ? SPACING.BLOCKQUOTE_BEFORE : 0,
              after: SPACING.BLOCKQUOTE_AFTER,
            },
          })
        )
      }
      i += 3
    } else {
      i++
    }
  }

  return { elements, endIndex: i }
}

/**
 * Parse a table
 */
function parseTable(tokens: Token[], startIndex: number): { table: Table; endIndex: number } {
  const rows: TableRow[] = []
  let i = startIndex + 1
  let isHeader = false

  while (i < tokens.length) {
    const token = tokens[i]

    if (token.type === 'table_close') {
      break
    }

    if (token.type === 'thead_open') {
      isHeader = true
      i++
      continue
    }

    if (token.type === 'thead_close') {
      isHeader = false
      i++
      continue
    }

    if (token.type === 'tbody_open' || token.type === 'tbody_close') {
      i++
      continue
    }

    if (token.type === 'tr_open') {
      const rowResult = parseTableRow(tokens, i, isHeader)
      rows.push(rowResult.row)
      i = rowResult.endIndex + 1
      continue
    }

    i++
  }

  const table = new Table({
    rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  })

  return { table, endIndex: i }
}

/**
 * Parse a table row
 */
function parseTableRow(tokens: Token[], startIndex: number, isHeader: boolean): { row: TableRow; endIndex: number } {
  const cells: TableCell[] = []
  let i = startIndex + 1

  while (i < tokens.length) {
    const token = tokens[i]

    if (token.type === 'tr_close') {
      break
    }

    if (token.type === 'th_open' || token.type === 'td_open') {
      const cellResult = parseTableCell(tokens, i, isHeader)
      cells.push(cellResult.cell)
      i = cellResult.endIndex + 1
      continue
    }

    i++
  }

  return {
    row: new TableRow({ children: cells }),
    endIndex: i,
  }
}

/**
 * Parse a table cell
 */
function parseTableCell(tokens: Token[], startIndex: number, isHeader: boolean): { cell: TableCell; endIndex: number } {
  let i = startIndex + 1
  let content: (TextRun | ExternalHyperlink)[] = []

  while (i < tokens.length) {
    const token = tokens[i]

    if (token.type === 'th_close' || token.type === 'td_close') {
      break
    }

    if (token.type === 'inline') {
      content = parseInlineContent(token.children || [], token.content)
    }

    i++
  }

  // If no content, add empty text
  if (content.length === 0) {
    content = [new TextRun({ text: '' })]
  }

  return {
    cell: new TableCell({
      children: [
        new Paragraph({
          children: content,
          alignment: AlignmentType.LEFT,
        }),
      ],
      shading: isHeader ? { fill: 'F0F0F0' } : undefined,
    }),
    endIndex: i,
  }
}

/**
 * Download blob as a DOCX file
 */
export const saveDocxBlob = (blob: Blob, filename: string): void => {
  saveBlobAsFile(blob, filename, 'docx')
}
