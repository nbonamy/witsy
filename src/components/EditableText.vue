
<template>
  <div class="container">
    <div class="placeholder" ref="pholder" v-if="showPlaceholder" v-html="placeholder" @click="onClickPlaceholder" />
    <div class="content" contenteditable="true" ref="text" @blur="onBlur" @focus="onFocus" @paste.prevent="onPaste" autofocus="true">
    </div>
  </div>
</template>
 
<!-- <div>"Moonlit Dreams"</div>
<div>&nbsp;</div>
<div>The night sky whispers secrets to the breeze,</div>
<div>A gentle lullaby, a soothing ease.</div>
<div>The moon, a glowing orb, casts its silver light,</div>
<div>A beacon in the darkness, a guiding sight.</div>
<div>&nbsp;</div>
<div>The stars twinkle like diamonds in the sky,</div>
<div>A celestial showcase, as the moments fly.</div>
<div>The world is hushed, a quiet peaceful place,</div>
<div>Where dreams and magic fill every space.</div>
<div>&nbsp;</div>
<div>In this stillness, I find my heart's reprieve,</div>
<div>A sense of calm, a soul that eve.</div>
<div>The world may rage, with passions and with strife,</div>
<div>But in the moon's soft light, I find my life.</div>
<div>&nbsp;</div>
<div>So let the night's sweet music lull me in,</div>
<div>And let the moon's soft light upon my skin.</div>
<div>For in its gentle beams, I find my peaceful nest,</div>
<div>A place where love and dreams forever rest.</div>
<div>&nbsp;</div>
<div>In this moonlit world, I find my own,</div>
<div>A place where love and dreams are made to atone.</div>
<div>The night's dark shadows, they no longer fright,</div>
<div>For in the moon's soft light, I know I am right.</div> -->

<script setup>

// components
import { ref, onMounted } from 'vue'

const props = defineProps({
  placeholder: String,
})

const text = ref(null)
const pholder = ref(null)
const showPlaceholder = ref(true)
let textSelection = null

const hightlightColor = 'rgb(180, 215, 255)'

onMounted(() => {

  text.value.addEventListener('keydown', checkPlaceholder)
  text.value.addEventListener('keyup', checkPlaceholder)
  text.value.addEventListener('keyup', checkSelection)
  checkPlaceholder({ which: 0 })

  // mouse stuff is ticky as mouseup could be outside of text
  // but at the same time we don't want to get them all the time
  const onMouseUp = (ev) => {
    window.removeEventListener('mouseup', onMouseUp)
    checkSelection(ev)
  }
  text.value.addEventListener('mousedown', () => {
    window.addEventListener('mouseup', onMouseUp)
  })

})

const getContent = () => {

  //
  let result = {
    content: '',
    selection: null,
    cursor: null,
    start: null,
    end: null,
  }

  // in case there is no selection, we may want the cursor position
  let cursorIndex = -1
  let cursorOffset = -1
  if (!textSelection) {
    const selection = window.getSelection()
    if (selection.isCollapsed) {
      cursorIndex = indexInNodeList(text.value.childNodes, selection.anchorNode)
      cursorOffset = selection.anchorOffset
    }
  }

  // now loop
  let cursorFound = false
  let startFound = false
  let endFound = false
  for (const index in [...text.value.childNodes]) {

    // is this the start element?
    let isStart = false
    if (!startFound && textSelection) {
      if (index == textSelection.startIndex) {
        startFound = true
        isStart = true
      }
    }

    // is this the end element?
    let isEnd = false
    if (!endFound && textSelection) {
      if (index == textSelection.endIndex) {
        endFound = true
        isEnd = true
      }
    }

    // is this the cursor element
    if (!cursorFound && index == cursorIndex) {
      cursorFound = true
      result.cursor = result.content.length + cursorOffset
    }

    // now the position
    const child = text.value.childNodes[index]

    // start position
    if (isStart) {
      result.start = result.content.length + textSelection.startPos
    }

    // end position
    if (isEnd) {
      result.end = result.content.length + textSelection.endPos
    }

    // now add text
    let content = child.textContent || ''
    while (content.endsWith(' ')) {
      content = content.substring(0, content.length - 1)
    }
    result.content += content + '\n'

  }

  // remove last newline
  result.content = result.content.substring(0, result.content.length - 1)

  // calc selection
  if (result.start !== null && result.end !== null) {
    result.selection = result.content.substring(result.start, result.end)
  }

  // done
  return result

}

const setContent = ({ content, start, end }) => {

  // as fast as possible
  if (content.length) {
    hidePlaceholder()
  }

  // clear the content
  text.value.innerHTML = ''

  // quick exit
  if (!content.length) {
    textSelection = null
    showPlaceholder.value = true
    return
  }

  // init
  textSelection = {
    startIndex: -1,
    startPos: -1,
    endIndex: -1,
    endPos: -1,
  }

  // needed
  const select = ((start !== null && start !== 0) || (end !== null && end !== 0))

  // split by newlines
  const lines = content.split('\n')
  // console.log(lines)

  // add one div per line
  let characters = 0
  for (let line of lines) {

    // we need that
    const length = line.length + 1

    // should we select
    let isStart = false
    if (select && textSelection.startIndex == -1 && characters + length >= start) {
      isStart = true
      textSelection.startIndex = text.value.childNodes.length // not added yet
      textSelection.startPos = start - characters
      // console.log('start', characters, start, textSelection.startIndex, textSelection.startPos)
    }

    // should we select
    let isEnd = false
    if (select && textSelection.endIndex == -1 && characters + length >= end) {
      isEnd = true
      textSelection.endIndex = text.value.childNodes.length // not added yet
      textSelection.endPos = end - characters
      // console.log('end', characters, end, textSelection.endIndex, textSelection.endPos)
    }

    // add br if empty
    if (!line.length) {
      const isSelected = (textSelection.startIndex !== -1 && (isEnd || textSelection.endIndex === -1))
      const div = document.createElement('div')
      const span = document.createElement('span')
      if (isSelected) {
        span.style.backgroundColor = hightlightColor
      }
      span.appendChild(document.createTextNode('\u00A0'))
      div.appendChild(span)
      text.value.appendChild(div)
      characters += length
      continue
    }

    // the nodes we need
    const nodes = {
      left: null,
      middle: null,
      right: null,
    }

    // split for start
    if (isStart) {

      // add the start without the selection
      if (textSelection.startPos > 0) {
        const left = line.substring(0, textSelection.startPos)
        const elem = document.createElement('span')
        elem.innerHTML = left
        nodes.left = elem
      }

      // remainder
      line = line.substring(textSelection.startPos)

    }

    // split for end
    if (isEnd) {

      // add the end without the selection
      const right = line.substring(textSelection.endPos - textSelection.startPos)
      const elem = document.createElement('span')
      elem.innerHTML = right
      nodes.right = elem

      // remainder
      line = line.substring(0, textSelection.endPos - textSelection.startPos)

    }

    // add the middle
    if (line.length) {

      const isSelected = (textSelection.startIndex !== -1 && (isEnd || textSelection.endIndex === -1))

      const elem = document.createElement('span')
      if (isSelected) elem.style.backgroundColor = hightlightColor
      elem.innerHTML = line
      nodes.middle = elem

    }

    // add a div with the content
    const div = document.createElement('div')
    if (nodes.left) div.appendChild(nodes.left)
    if (nodes.middle) div.appendChild(nodes.middle)
    if (nodes.right) div.appendChild(nodes.right)
    text.value.appendChild(div)
    characters += line.length + 1

  }

  // check
  if (textSelection.startIndex === -1 || textSelection.endIndex === -1) {
    textSelection = null
  }

  // log
  //console.log(textSelection)

  // done
  checkPlaceholder({ which: 0 })

}

const checkPlaceholder = (ev) => {
  showPlaceholder.value = (ev.witch >= 32 || !text.value.textContent.length)
  if (!showPlaceholder.value) {
    // do not wait for vue to hide this (too slow)
    hidePlaceholder()
  }
}

const hidePlaceholder = () => {
  if (pholder.value) {
    pholder.value.style.display = 'none'
  }
}

// this will check in the index in nodeList
// of node or first parent which is in nodeList
const indexInNodeList = (nodeList, node) => {
  const index = Array.prototype.indexOf.call(nodeList, node)
  if (index !== -1) return index
  if (node?.parentNode === null) return -1
  return indexInNodeList(nodeList, node.parentNode)
}

const checkSelection = (ev) => {

  // get system selection
  const selection = window.getSelection()
  if (selection.isCollapsed) {
    textSelection = null
    return
  }

  // get some values
  let startNode = selection.anchorNode
  let endNode = selection.focusNode
  let startPos = selection.anchorOffset
  let endPos = selection.focusOffset

  // find the direct child of text the nodes belong to (it could be a grand grand child...)
  let startIndex = indexInNodeList(text.value.childNodes, startNode)
  let endIndex = indexInNodeList(text.value.childNodes, endNode)
  if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find start or end node', selection)
    textSelection = null
    return
  }

  // now we want start to be before end
  // this is not the case if the user shift-clicks in the opposite direction
  const swap = (startIndex > endIndex) || (startIndex === endIndex && startPos > endPos)
  if (swap) {
    const tempPos = startPos
    const tempIndex = startIndex
    startPos = endPos
    startIndex = endIndex
    endPos = tempPos
    endIndex = tempIndex
  }

  // we don't like when endPos == 0 (let's go back one item)
  if (endPos === 0) {
    endIndex = endIndex - 1
    endPos = text.value.childNodes[endIndex].textContent.length
  }

  // set the selection
  if (startIndex === endIndex && startPos === endPos) {
    textSelection = null
  } else {
    textSelection = {
      startIndex,
      startPos,
      endIndex,
      endPos,
    }
  }

  // log
  //console.log(textSelection)

}

const onClickPlaceholder = () => {
  text.value.focus()
}

const onBlur = () => {

  if (!textSelection) {
    return
  }

  let startFound = false
  let endFound = false
  for (const index in text.value.childNodes) {

    // is this the start element?
    let isStart = false
    if (startFound == false) {
      if (index == textSelection.startIndex) {
        startFound = true
        isStart = true
      }
    }

    // continue
    if (!startFound) {
      continue
    }

    // is this the end element?
    let isEnd = false
    if (index == textSelection.endIndex) {
      endFound = true
      isEnd = true
    }

    // now the position
    const child = text.value.childNodes[index]
    const start = isStart ? textSelection.startPos : 0
    const end = isEnd ? textSelection.endPos : child.textContent.length + 1

    // now highlight
    const left = child.textContent.substring(0, start)
    let middle = child.textContent.substring(start, end)
    const right = child.textContent.substring(end)

    // empty line
    if (!middle.length) {
      middle = '&nbsp;'
    } else if (!right.length && !isEnd) {
      middle += '&nbsp;'
    }

    // now we have everything
    let updated = `<span>${left}</span><span style="background-color: ${hightlightColor};">${middle}</span><span>${right}</span>`
    updated = updated.replaceAll('<span></span>', '')

    // if we have a text node
    if (child.nodeType === 3) {
      const elem = document.createElement('div')
      elem.innerHTML = updated
      text.value.replaceChild(elem, child)
    } else {
      child.innerHTML = updated
    }

    // done
    if (endFound) {
      break
    }

  }

  // report error
  if (!startFound || !endFound) {
    console.error('Could not find start or end node', textSelection)
  }

}

const onFocus = () => {

  // if we saved a selection
  // if (!textSelection) {
  //   return
  // }

  // first restore plain text
  for (const child of text.value.childNodes) {

    // remove the ending nbsp we have added
    const html = child.innerHTML
    if (html) {
      if (html.endsWith('&nbsp;')) {
        child.innerHTML = html.substring(0, html.length - 6)
      } else if (html.endsWith('&nbsp;</span>')) {
        child.innerHTML = html.substring(0, html.length - 13) + '</span>'
      }
    } 

    // now remove the highlights
    const textContent = child.textContent
    if (textContent.length) {
      const elem = document.createElement('div')
      const span = document.createElement('span')
      span.textContent = textContent
      elem.appendChild(span)
      text.value.replaceChild(elem, child)
    } else {
      const elem = document.createElement('div')
      const span = document.createElement('span')
      span.appendChild(document.createTextNode('\u00A0'))
      elem.appendChild(span)
      text.value.replaceChild(elem, child)
    }
  }

  // // now restore selection
  // const selection = window.getSelection()
  // let startNode = text.value.childNodes[textSelection.startIndex]
  // let endNode = text.value.childNodes[textSelection.endIndex]
  // let startOffset = textSelection.startPos
  // let endOffset = textSelection.endPos

  // // now find the right child
  // if (startNode.childNodes.length == 1) {
  //   startNode = startNode.childNodes[0]
  // } else {
  //   for (const child of startNode.childNodes) {
  //     if (startOffset < child.textContent.length) {
  //       startNode = child
  //       break
  //     }
  //     startOffset -= child.textContent.length
  //   }
  // }

  // // same for end
  // if (endNode.childNodes.length == 1) {
  //   endNode = endNode.childNodes[0]
  // } else {
  //   for (const child of endNode.childNodes) {
  //     if (endOffset < child.textContent.length) {
  //       endNode = child
  //       break
  //     }
  //     endOffset -= child.textContent.length
  //   }
  // }

  // // now do it
  // //console.log(startNode, startOffset, endNode, endOffset)
  // selection.setBaseAndExtent(startNode, startOffset, endNode, endOffset || 1)
  // checkSelection()

}

const onPaste = (ev) => {

  // we only accept text
  const text = ev.clipboardData.getData('text/plain')
  if (!text || !text.length) {
    return
  }

  // now we need to insert the text, replacing if there is selection
  const content = getContent()
  if (content.selection == null && content.cursor != -1) {
    content.start = content.cursor
    content.end = content.cursor
  }
  const before = content.content.substring(0, content.start)
  const after = content.content.substring(content.end)
  const updated = before + text + after
  setContent({ content: updated, start: 0, end: 0 })

}

defineExpose({ getContent, setContent })

</script>

<style scoped>

.container {
  display: flex;
  flex-direction: column;
}

.placeholder {
  position: fixed;
  line-height: 1.2lh;
  width: 60%;
  left: 20%;
  padding-top: 64px;
  color: var(--scratchpad-placeholder-text-color) !important;
  text-align: center;
  font-style: italic;
  white-space: nowrap;
}

.content {
  flex: 1;
}

</style>