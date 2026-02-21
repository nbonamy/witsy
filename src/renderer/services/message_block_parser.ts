import { ToolCall } from 'types/index'
import { closeOpenMarkdownTags, getCodeBlocks, isHtmlContent } from './markdown'
import { kSearchPluginName } from './plugins/search'
import { store } from './store'

// Debug flag for block parser logging
const DEBUG_BLOCK_PARSER = false

/**
 * Block metadata for incremental parsing optimization.
 * - start/end: Position in the ORIGINAL (pre-transformation) content
 * - stable: Whether this block is complete and won't change during streaming
 */
export type BlockMeta = {
  start: number
  end: number
  stable: boolean
}

type BlockEmpty = {
  type: 'empty'
}

type BlockText = {
  type: 'text'
  content: string
}

type BlockUserText = {
  type: 'user-text'
  content: string
}

type BlockMedia = {
  type: 'media'
  url: string
  desc?: string
  prompt?: string
}

type BlockArtifact = {
  type: 'artifact'
  title: string
  content: string
}

type BlockHtml = {
  type: 'html'
  title: string
  content: string
}

type BlockTool = {
  type: 'tool'
  toolCall: ToolCall
}

type BlockSearch = {
  type: 'search'
  toolCall: ToolCall
}

type BlockTable = {
  type: 'table'
  content: string
}

type BlockContent = BlockEmpty | BlockText | BlockUserText | BlockMedia | BlockArtifact | BlockHtml | BlockTool | BlockSearch | BlockTable

export type Block = BlockMeta & BlockContent

export interface ComputeBlocksOptions {
  role: 'user' | 'assistant' | 'system'
  transient: boolean
  toolCalls: ToolCall[]
  showToolCalls: 'always' | 'never' | 'calling'
}

const highlightSearch = (html: string): string => {
  if (store.chatState.filter) {
    const regex = new RegExp(store.chatState.filter, 'gi')
    html = html.replace(regex, (match) => `<mark>${match}</mark>`)
  }
  return html
}

/**
 * Check if content has an unclosed artifact tag.
 * Returns the position of the unclosed <artifact if found, -1 otherwise.
 */
const findUnclosedArtifact = (content: string): number => {
  const index1 = content.lastIndexOf('<artifact')
  const index2 = content.lastIndexOf('</artifact>')
  if (index1 > index2) {
    return index1
  }
  return -1
}

const closeOpenArtifactTags = (content: string): string => {
  if (findUnclosedArtifact(content) >= 0) {
    content += '</artifact>'
  }
  return content
}

/**
 * Parse user messages: plain text with fenced code blocks extracted and rendered.
 * Text segments are marked as 'user-text' (rendered as escaped plain text with inline code),
 * fenced code blocks are 'text' (rendered through markdown for syntax highlighting).
 */
const computeUserBlocks = (content: string): Block[] => {
  // only extract fenced code blocks (``` or ~~~), not inline backticks
  const codeBlocks = getCodeBlocks(content).filter(cb => {
    const snippet = content.substring(cb.start, cb.start + 3)
    return snippet === '```' || snippet === '~~~'
  })

  // no fenced code blocks: return as single user-text block
  if (codeBlocks.length === 0) {
    return [{
      type: 'user-text',
      content: content,
      start: 0,
      end: content.length,
      stable: true
    }]
  }

  const blocks: Block[] = []
  let lastIndex = 0

  for (const cb of codeBlocks) {
    // text before this code block
    if (cb.start > lastIndex) {
      const text = content.substring(lastIndex, cb.start)
      if (text.trim().length > 0) {
        blocks.push({
          type: 'user-text',
          content: text,
          start: lastIndex,
          end: cb.start,
          stable: true
        })
      }
    }
    // the fenced code block itself (rendered through markdown)
    blocks.push({
      type: 'text',
      content: content.substring(cb.start, cb.end + 1),
      start: cb.start,
      end: cb.end + 1,
      stable: true
    })
    lastIndex = cb.end + 1
  }

  // text after the last code block
  if (lastIndex < content.length) {
    const text = content.substring(lastIndex)
    if (text.trim().length > 0) {
      blocks.push({
        type: 'user-text',
        content: text,
        start: lastIndex,
        end: content.length,
        stable: true
      })
    }
  }

  return blocks
}

export const computeBlocks = (content: string | null, options: ComputeBlocksOptions): Block[] => {
  // if no content, return empty
  if (!content || content.trim().length === 0 || content.replaceAll('\n', '').trim().length === 0) {
    if (DEBUG_BLOCK_PARSER) {
      console.debug('[BlockParser] computeBlocks: empty content')
    }
    return []
  }

  if (DEBUG_BLOCK_PARSER) {
    console.debug(`[BlockParser] computeBlocks: role=${options.role}, transient=${options.transient}, len=${content.length}`)
  }

  // Store original content length for position tracking
  const originalLength = content.length

  // user message: render as plain text but extract code blocks
  if (options.role !== 'assistant') {
    return computeUserBlocks(content)
  }

  // Check for unclosed artifact BEFORE transformation
  const unclosedArtifactPos = findUnclosedArtifact(content)

  // if transient make sure we close markdown tags
  if (options.transient) {
    content = closeOpenMarkdownTags(content)
  }

  // we always close artifacts because the user may have interrupted
  // and this is cheap
  content = closeOpenArtifactTags(content)

  // now get the code blocks
  const codeBlocks: { start: number, end: number }[] = getCodeBlocks(content)

  // extract each special tags in a separate block
  let lastIndex = 0
  const blocks: Block[] = []
  // Updated regex to exclude images that are inside markdown links [![alt](url)](link)
  // Negative lookbehind (?<!\[) prevents matching when preceded by '['
  const regexMedia1 = /(?<!\[)!\[([^\]]*)\]\(([^)]*)\)/g
  const regexMedia2 = /<(?:img|video)[^>]*?src="([^"]*)"[^>]*?>/g
  const regexArtifact1 = /<artifact.*?title="([^"]*)".*?>(.*?)<\/artifact>/gms
  const regexTool1 = /<tool (id|index)="([^"]*)"><\/tool>/g
  const regexTable1 = /\|(.+)\|[\r\n]+\|[-:\s|]+\|[\r\n]+((?:\|.+\|[\r\n]*)+)/g

  while (lastIndex < content.length) {
    // Find the next match for each regex from current position
    const matches = []

    // Reset regex lastIndex to search from current position
    regexMedia1.lastIndex = lastIndex
    regexMedia2.lastIndex = lastIndex
    regexArtifact1.lastIndex = lastIndex
    regexTool1.lastIndex = lastIndex
    regexTable1.lastIndex = lastIndex

    const media1Match = regexMedia1.exec(content)
    const media2Match = regexMedia2.exec(content)
    const artifact1Match = regexArtifact1.exec(content)
    const tool1Match = regexTool1.exec(content)
    const table1Match = regexTable1.exec(content)

    // Collect valid matches (not inside code blocks)
    if (media1Match && !codeBlocks.find(block => media1Match.index >= block.start && media1Match.index < block.end)) {
      matches.push({ match: media1Match, type: 'media1', regex: regexMedia1 })
    }
    if (media2Match && !codeBlocks.find(block => media2Match.index >= block.start && media2Match.index < block.end)) {
      matches.push({ match: media2Match, type: 'media2', regex: regexMedia2 })
    }
    if (artifact1Match && !codeBlocks.find(block => artifact1Match.index >= block.start && artifact1Match.index < block.end)) {
      matches.push({ match: artifact1Match, type: 'artifact', regex: regexArtifact1 })
    }
    if (tool1Match && !codeBlocks.find(block => tool1Match.index >= block.start && tool1Match.index < block.end)) {
      matches.push({ match: tool1Match, type: 'tool', regex: regexTool1 })
    }
    if (table1Match && !codeBlocks.find(block => table1Match.index >= block.start && table1Match.index < block.end)) {
      matches.push({ match: table1Match, type: 'table', regex: regexTable1 })
    }

    // If no matches found, add remaining content as text and break
    if (matches.length === 0) {
      if (lastIndex < content.length) {
        const textContent = content.substring(lastIndex)
        // Clamp end position to original content length (before transformations)
        const endPos = Math.min(lastIndex + textContent.length, originalLength)
        blocks.push({
          type: 'text',
          content: textContent,
          start: lastIndex,
          end: endPos,
          // Text at the end is never stable during streaming - more content can be appended
          stable: !options.transient
        })
      }
      break
    }

    // Find the match with the lowest index (earliest in the string)
    const nextMatch = matches.reduce((earliest, current) =>
      current.match.index < earliest.match.index ? current : earliest
    )

    const match = nextMatch.match
    const matchType = nextMatch.type
    const matchStart = match.index
    const matchEnd = match.index + match[0].length

    // Add text content before this match
    if (matchStart > lastIndex) {
      blocks.push({
        type: 'text',
        content: content.substring(lastIndex, matchStart),
        start: lastIndex,
        end: matchStart,
        // Text before a matched block is stable (we found something after it)
        stable: true
      })
    }

    // Process the match based on its type
    if (matchType === 'tool') {
      if (options.toolCalls.length) {
        const toolCall =
          match[1] === 'id' ? options.toolCalls.find(call => call.id === match[2]) :
            match[1] === 'index' ? options.toolCalls[parseInt(match[2])] : null
        if (toolCall && toolCall.done) {
          if (options.showToolCalls === 'always') {
            blocks.push({
              type: 'tool',
              toolCall: toolCall,
              start: matchStart,
              end: matchEnd,
              // Tool blocks are immediately stable - fully matched
              stable: true
            })
          } else if (toolCall.function === kSearchPluginName) {
            blocks.push({
              type: 'search',
              toolCall: toolCall,
              start: matchStart,
              end: matchEnd,
              // Search blocks are immediately stable - fully matched
              stable: true
            })
          }
        }
      }
    } else if (matchType === 'media1' || matchType === 'media2') {
      // Process media (both types)
      let imageUrl = decodeURIComponent(match[match.length - 1])
      if (!imageUrl.startsWith('http') && !imageUrl.startsWith('file://') && !imageUrl.startsWith('data:image/')) {
        imageUrl = `file://${imageUrl}`
      }

      // try to find the prompt
      let prompt = null
      if (options.toolCalls) {
        for (const call of options.toolCalls) {
          const toolPath = call.result?.path || call.result?.url
          if (toolPath === match[match.length - 1] || toolPath === decodeURIComponent(match[match.length - 1])) {
            prompt = call.args.prompt
            break
          }
        }
      }

      // done
      const desc = match.length === 3 ? match[1] : 'Video'
      blocks.push({
        type: 'media',
        url: imageUrl,
        desc,
        prompt,
        start: matchStart,
        end: matchEnd,
        // Media blocks are immediately stable - fully matched regex
        stable: true
      })
    } else if (matchType === 'artifact') {
      // Check if artifact content is HTML
      const artifactContent = match[2]
      const isHtml = isHtmlContent(artifactContent)

      // Artifact is stable ONLY if it was NOT auto-closed
      // If unclosedArtifactPos >= 0 and this artifact starts at or after that position,
      // it means this artifact was auto-closed and is unstable
      const isAutoClosedArtifact = unclosedArtifactPos >= 0 && matchStart >= unclosedArtifactPos

      if (isHtml) {
        blocks.push({
          type: 'html',
          title: match[1],
          content: artifactContent,
          start: matchStart,
          end: matchEnd,
          stable: !isAutoClosedArtifact
        })
      } else {
        blocks.push({
          type: 'artifact',
          title: match[1],
          content: artifactContent,
          start: matchStart,
          end: matchEnd,
          stable: !isAutoClosedArtifact
        })
      }
    } else if (matchType === 'table') {
      // Render the markdown table to HTML
      const tableMarkdown = match[0]
      const tableHtml = window.api.markdown.render(tableMarkdown)
      blocks.push({
        type: 'table',
        content: highlightSearch(tableHtml),
        start: matchStart,
        end: matchEnd,
        // Table blocks are immediately stable - fully matched regex
        stable: true
      })
    }

    // Update lastIndex to continue after this match
    lastIndex = matchEnd
  }

  // done
  if (DEBUG_BLOCK_PARSER) {
    const stableCount = blocks.filter(b => b.stable).length
    const types = blocks.map(b => b.type).join(', ')
    console.debug(`[BlockParser] computeBlocks: ${blocks.length} blocks (${stableCount} stable): [${types}]`)
  }
  return blocks
}

/**
 * Compute blocks incrementally by reusing stable blocks from a previous computation.
 * This is optimized for streaming scenarios where content is appended incrementally.
 *
 * @param content - The current content to parse
 * @param options - Parsing options
 * @param previousBlocks - Blocks from the previous computation
 * @returns New array of blocks, reusing stable blocks where possible
 */
export const computeBlocksIncremental = (
  content: string | null,
  options: ComputeBlocksOptions,
  previousBlocks: Block[]
): Block[] => {
  // If no previous blocks or not transient, do full computation
  if (previousBlocks.length === 0 || !options.transient) {
    if (DEBUG_BLOCK_PARSER) {
      console.debug(`[BlockParser] Incremental: falling back to full computation (prev=${previousBlocks.length}, transient=${options.transient})`)
    }
    return computeBlocks(content, options)
  }

  // If no content, return empty
  if (!content || content.trim().length === 0 || content.replaceAll('\n', '').trim().length === 0) {
    if (DEBUG_BLOCK_PARSER) {
      console.debug('[BlockParser] Incremental: empty content')
    }
    return []
  }

  if (DEBUG_BLOCK_PARSER) {
    console.debug(`[BlockParser] Incremental: starting with ${previousBlocks.length} previous blocks, content len=${content.length}`)
  }

  // Find the first unstable block
  let stableEndIndex = 0
  const stableBlocks: Block[] = []

  for (const block of previousBlocks) {
    if (block.stable) {
      // Verify the block's content region still exists in the new content
      // (content is only appended, so if end <= content.length, it's still valid)
      if (block.end <= content.length) {
        stableBlocks.push(block)
        stableEndIndex = block.end
      } else {
        // Block extends beyond current content - shouldn't happen with append-only
        // but handle gracefully by stopping here
        break
      }
    } else {
      // Found first unstable block - recompute from its start position
      stableEndIndex = block.start
      break
    }
  }

  // If all blocks were stable and content hasn't grown, return previous blocks
  if (stableBlocks.length === previousBlocks.length && stableEndIndex >= content.length) {
    if (DEBUG_BLOCK_PARSER) {
      console.debug('[BlockParser] Incremental: all blocks stable, returning previous')
    }
    return previousBlocks
  }

  if (DEBUG_BLOCK_PARSER) {
    console.debug(`[BlockParser] Incremental: ${stableBlocks.length} stable blocks up to index ${stableEndIndex}`)
  }

  // For the incremental case, we do a full computation but keep stable blocks
  const newBlocks = computeBlocks(content, options)

  // Merge: keep stable blocks from previous, take new blocks for the rest
  const result: Block[] = []
  let newBlockIdx = 0
  let reusedCount = 0

  // Add stable blocks from previous computation
  for (const stableBlock of stableBlocks) {
    // Find corresponding block in newBlocks (should be at same position)
    while (newBlockIdx < newBlocks.length && newBlocks[newBlockIdx].end <= stableBlock.end) {
      if (newBlocks[newBlockIdx].start === stableBlock.start &&
          newBlocks[newBlockIdx].end === stableBlock.end &&
          newBlocks[newBlockIdx].type === stableBlock.type) {
        // Same block - use the previous one (already computed/rendered)
        result.push(stableBlock)
        reusedCount++
        newBlockIdx++
        break
      }
      // Position mismatch - content structure changed, use new blocks
      result.push(newBlocks[newBlockIdx])
      newBlockIdx++
    }
  }

  // Add remaining new blocks
  while (newBlockIdx < newBlocks.length) {
    result.push(newBlocks[newBlockIdx])
    newBlockIdx++
  }

  const finalResult = result.length > 0 ? result : newBlocks
  if (DEBUG_BLOCK_PARSER) {
    console.debug(`[BlockParser] Incremental: reused ${reusedCount}/${finalResult.length} stable blocks`)
  }

  return finalResult
}
