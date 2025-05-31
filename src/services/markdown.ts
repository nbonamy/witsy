export const closeOpenMarkdownTags = (input: string): string => {

  const mdTags: string[] = [
    '```',
    '~~~',
    '***',
    '___',
    '**',
    '__',
    '*',
    '_',
    '`'
  ]

  const codeTags = ['```', '~~~', '`']

  let i: number = 0
  const stack: string[] = []
  let inCodeBlock = false

  // Track active tags
  while (i < input.length) {

    let matched = false
    for (const tag of mdTags) {

      if (input.startsWith(tag, i)) {
        
        // we do not stack the tag if it is at the end of the input
        const stackCurrent = (i + tag.length < input.length)

        // Handle code blocks specially
        if (codeTags.includes(tag)) {
          
          // Check if top of stack has same tag (closing)
          const top = stack[stack.length - 1]
          if (top && top === tag) {
            stack.pop()
            inCodeBlock = false
          } else if (!inCodeBlock && stackCurrent){
            stack.push(tag)
            inCodeBlock = true
          }
        
        } else if (!inCodeBlock) {
        
          // Only process other markdown tags if not in a code block
          const top = stack[stack.length - 1]
          if (top && top === tag) {
            stack.pop()
          } else if (stackCurrent){
            stack.push(tag)
          }
        
        }

        // move to next character after the tag
        i += tag.length
        matched = true
        break
      }
    }

    // if no tag matched, just move to the next character
    if (!matched) {
      i++
    }
  }

  if (stack.length > 5) {
    console.warn('Too many open markdown tags, closing all', input, stack)
  }

  // Handle mismatched inline like **t* -> **t** (only if not in code block)
  if (!inCodeBlock && input.match(/\*\*[^*]+?\*$/)) {
    input += '*'
    return input
  }
  if (!inCodeBlock && input.match(/__[^_]+?_$/)) {
    input += '_'
    return input
  }

  // close any remaining tags
  while (stack.length > 0) {
    const tag = stack.pop()
    input += tag
  }

  // Handle links and images (only if not in code block)
  if (!inCodeBlock) {
    const unmatchedLeftBracket = input.lastIndexOf('[')
    const unmatchedRightBracket = input.lastIndexOf(']')
    const unmatchedLeftParen = input.lastIndexOf('](')
    const unmatchedRightParen = input.lastIndexOf(')')

    if (unmatchedLeftBracket > unmatchedRightBracket) {
      input += ']'
    }

    if (unmatchedLeftParen > unmatchedRightParen) {
      input += ')'
    }
  }

  return input
}

export const getCodeBlocks = (input: string): { start: number, end: number }[] => {

  const codeTags = ['```', '~~~', '`']
  const blocks: { start: number, end: number }[] = []
  
  let i = 0
  
  while (i < input.length) {
    let matched = false
    
    for (const tag of codeTags) {
      
      if (input.startsWith(tag, i)) {
        
        const start = i
        i += tag.length
        
        // Find the closing tag
        let found = false
        while (i < input.length) {
          
          if (input.startsWith(tag, i)) {

            // check if we find a longer tag that matchs
            const others = codeTags.filter(t => t.length > tag.length).filter(t => input.startsWith(t, i))
            if (others.length > 0) {
              // advance to the end of the longest tag
              const longestTag = others.reduce((a, b) => a.length > b.length ? a : b)
              i += longestTag.length
            } else {
              const end = i + tag.length
              blocks.push({ start, end: end - 1 })
              i = end
              found = true
              break
            }
          }
          i++
        }
        
        // If no closing tag found, treat rest of string as code block
        if (!found) {
          blocks.push({ start, end: input.length - 1 })
        }
        
        matched = true
        break
      }
    }
    
    if (!matched) {
      i++
    }
  }
  
  return blocks
}
