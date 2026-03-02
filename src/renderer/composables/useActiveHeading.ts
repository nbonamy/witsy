import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import type { OutlineHeading } from './useOutline'

export interface ActiveHeadingComposable {
  activeHeadingId: Ref<string | null>
  setupObserver: () => void
  cleanup: () => void
}

export function useActiveHeading(
  editor: Ref<Editor | null | undefined>,
  headings: Ref<OutlineHeading[]>,
  isActive: Ref<boolean>
): ActiveHeadingComposable {
  const activeHeadingId = ref<string | null>(null)
  let observerInstance: IntersectionObserver | null = null

  /**
   * Recursively find heading by text content
   */
  const findHeadingByText = (items: OutlineHeading[], text: string): OutlineHeading | null => {
    for (const heading of items) {
      if (heading.text === text) return heading
      const found = findHeadingByText(heading.children, text)
      if (found) return found
    }
    return null
  }

  /**
   * Setup Intersection Observer to track visible headings
   */
  const setupObserver = () => {
    cleanup() // Clean up any existing observer

    if (!editor.value || !isActive.value) return

    // Find the editor content container
    const editorElement = document.querySelector('.tiptap-content .tiptap')
    if (!editorElement) return

    // Find all heading elements
    const headingElements = editorElement.querySelectorAll('h1, h2, h3, h4, h5, h6')
    if (headingElements.length === 0) return

    // Create intersection observer
    observerInstance = new IntersectionObserver(
      (entries) => {
        // Filter visible headings and sort by position
        const visibleHeadings = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visibleHeadings.length > 0) {
          // Get the topmost visible heading
          const topHeading = visibleHeadings[0].target as HTMLElement
          const headingText = topHeading.textContent || ''

          // Find matching heading in our data structure
          const heading = findHeadingByText(headings.value, headingText)
          if (heading) {
            activeHeadingId.value = heading.id
          }
        }
      },
      {
        root: editorElement,
        rootMargin: '-10% 0px -80% 0px', // Trigger when heading is near top of viewport
        threshold: 0
      }
    )

    // Observe all heading elements
    headingElements.forEach(el => {
      observerInstance?.observe(el)
    })
  }

  /**
   * Cleanup intersection observer
   */
  const cleanup = () => {
    if (observerInstance) {
      observerInstance.disconnect()
      observerInstance = null
    }
  }

  // Watch for outline activation state
  watch(isActive, (newActive) => {
    if (newActive) {
      setupObserver()
    } else {
      cleanup()
    }
  }, { immediate: true })

  // Watch for heading changes (document structure changed)
  watch(headings, () => {
    if (isActive.value) {
      setupObserver()
    }
  })

  // Cleanup on component unmount
  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    activeHeadingId,
    setupObserver,
    cleanup
  }
}
