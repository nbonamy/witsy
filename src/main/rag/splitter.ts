
import { Configuration } from 'types/config'
import defaultSettings from '../../../defaults/settings.json'

export default class {

  config: Configuration
  chunkSize: number
  chunkOverlap: number
  separators: string[] = ["\n\n", "\n", " ", ""]

  constructor(config: Configuration) {
    this.config = config
    this.chunkSize = this.config.rag?.chunkSize ?? defaultSettings.rag.chunkSize
    this.chunkOverlap = this.config.rag?.chunkOverlap ?? defaultSettings.rag.chunkOverlap
  }

  // Non-blocking implementation of recursive character text splitting
  // Based on LangChain's RecursiveCharacterTextSplitter but with yields to prevent UI blocking
  async split(text: string): Promise<string[]> {
    return this.splitTextRecursive(text, this.separators)
  }

  private async splitTextRecursive(text: string, separators: string[]): Promise<string[]> {
    const finalChunks: string[] = []

    // Find appropriate separator
    let separator = separators[separators.length - 1]
    let newSeparators: string[] | undefined

    for (const s of separators) {
      if (s === "") {
        separator = s
        break
      }
      if (text.includes(s)) {
        separator = s
        newSeparators = separators.slice(separators.indexOf(s) + 1)
        break
      }
    }

    // Split on separator
    const splits = this.splitOnSeparator(text, separator)

    // Merge and recursively split
    const goodSplits: string[] = []
    let iterationCount = 0

    for (const s of splits) {
      // Yield every 100 iterations to prevent blocking
      if (++iterationCount % 100 === 0) {
        await new Promise(resolve => setImmediate(resolve))
      }

      if (s.length < this.chunkSize) {
        goodSplits.push(s)
      } else {
        if (goodSplits.length > 0) {
          const mergedText = await this.mergeSplits(goodSplits, separator)
          finalChunks.push(...mergedText)
          goodSplits.length = 0
        }

        if (!newSeparators) {
          finalChunks.push(s)
        } else {
          const otherChunks = await this.splitTextRecursive(s, newSeparators)
          finalChunks.push(...otherChunks)
        }
      }
    }

    if (goodSplits.length > 0) {
      const mergedText = await this.mergeSplits(goodSplits, separator)
      finalChunks.push(...mergedText)
    }

    return finalChunks
  }

  private splitOnSeparator(text: string, separator: string): string[] {
    if (!separator) {
      return text.split("")
    }
    // Keep separator at start of each split
    const regexEscapedSeparator = separator.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&")
    const splits = text.split(new RegExp(`(?=${regexEscapedSeparator})`))
    return splits.filter(s => s !== "")
  }

  private async mergeSplits(splits: string[], separator: string): Promise<string[]> {
    const docs: string[] = []
    const currentDoc: string[] = []
    let total = 0
    let iterationCount = 0

    for (const d of splits) {
      // Yield every 100 iterations to prevent blocking
      if (++iterationCount % 100 === 0) {
        await new Promise(resolve => setImmediate(resolve))
      }

      const len = d.length

      if (total + len + currentDoc.length * separator.length > this.chunkSize) {
        if (currentDoc.length > 0) {
          const doc = currentDoc.join(separator)
          if (doc) {
            docs.push(doc)
          }

          // Keep overlap
          while (total > this.chunkOverlap ||
            (total + len + currentDoc.length * separator.length > this.chunkSize && total > 0)) {
            total -= currentDoc[0].length
            currentDoc.shift()
          }
        }
      }

      currentDoc.push(d)
      total += len
    }

    const doc = currentDoc.join(separator)
    if (doc) {
      docs.push(doc)
    }

    return docs
  }

}
