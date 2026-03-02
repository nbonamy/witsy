import { ref, watch, type Ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'

export interface OutlineHeading {
  id: string
  text: string
  level: number
  pos: number
  children: OutlineHeading[]
}

export interface OutlineComposable {
  headings: Ref<OutlineHeading[]>
  isOutlineOpen: Ref<boolean>
  toggleOutline: () => void
  refreshHeadings: () => void
  navigateToHeading: (heading: OutlineHeading) => void
}

export function useOutline(editor: Ref<Editor | null | undefined>): OutlineComposable {
  const headings = ref<OutlineHeading[]>([])
  const isOutlineOpen = ref(false)
  let updateTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Extract headings from ProseMirror document
   * Builds hierarchical tree structure in single pass
   */
  const extractHeadings = (): OutlineHeading[] => {
    if (!editor.value) return []

    const result: OutlineHeading[] = []
    const stack: OutlineHeading[] = []

    editor.value.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const heading: OutlineHeading = {
          id: `heading-${pos}`,
          text: node.textContent || '',
          level: node.attrs.level as number,
          pos: pos,
          children: []
        }

        // Build hierarchy: pop stack until we find appropriate parent
        while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
          stack.pop()
        }

        // Add to parent's children or root
        if (stack.length === 0) {
          result.push(heading)
        } else {
          stack[stack.length - 1].children.push(heading)
        }

        stack.push(heading)
      }
    })

    return result
  }

  /**
   * Refresh headings with debouncing (300ms)
   * Prevents excessive rebuilding during typing
   */
  const refreshHeadings = () => {
    if (updateTimeout) {
      clearTimeout(updateTimeout)
    }

    updateTimeout = setTimeout(() => {
      headings.value = extractHeadings()
      updateTimeout = null
    }, 300)
  }

  /**
   * Navigate to heading using TipTap's navigation APIs
   */
  const navigateToHeading = (heading: OutlineHeading) => {
    if (!editor.value) return

    // Set cursor position at heading
    editor.value
      .chain()
      .focus()
      .setTextSelection(heading.pos)
      .run()

    // Find the heading DOM element and scroll it to the top
    const editorElement = document.querySelector('.tiptap-content .tiptap')
    if (editorElement) {
      const headingElements = editorElement.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const targetHeading = Array.from(headingElements).find(
        el => el.textContent === heading.text
      ) as HTMLElement

      if (targetHeading) {
        // Use native scrollIntoView with block: 'start' option
        targetHeading.scrollIntoView({ block: 'start', inline: 'nearest' })
      }
    }
  }

  /**
   * Toggle outline panel visibility
   */
  const toggleOutline = () => {
    isOutlineOpen.value = !isOutlineOpen.value
  }

  // Watch editor instance and set up update listener
  watch(
    editor,
    (newEditor) => {
      if (newEditor) {
        // Initial extraction
        headings.value = extractHeadings()

        // Listen for editor updates
        newEditor.on('update', refreshHeadings)
      }
    },
    { immediate: true }
  )

  return {
    headings,
    isOutlineOpen,
    toggleOutline,
    refreshHeadings,
    navigateToHeading
  }
}
