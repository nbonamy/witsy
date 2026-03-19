<template>
  <div class="tiptap-editor-wrapper">
    
    <!-- Link editor dialog -->
    <LinkEditor ref="linkEditor" @save="onLinkSave" @remove="onLinkRemove" />

    <div v-if="editor && !readOnly" class="tiptap-toolbars">

      <TiptapToolbar
        :editor="editor"
        :show-source-view="showSourceView"
        :show-marp-controls="showMarpControls"
        :show-source-toggle="showSourceToggle"
        :show-outline="showOutline"
        :show-table-controls="showTableControls"
        :show-alignment-controls="showAlignmentControls"
        :export-formats="exportFormats"
        :is-outline-open="isOutlineOpen"
        :outline-button-id="outlineButtonId"
        @switch-to-slideshow="emit('switch-to-slideshow')"
        @toggle-view-mode="toggleViewMode"
        @toggle-outline="toggleOutline"
        @set-link="setLink"
        @export-document="exportDocument"
      />

      <TiptapTableToolbar
        v-if="showTableControls"
        :editor="editor"
        :is-in-table="isInTable"
      />

    </div>

    <!-- Merge overlay with spinner -->
    <Transition name="merge-overlay">
      <div v-if="isMerging" class="merge-overlay">
        <Spinner class="merge-spinner" />
      </div>
    </Transition>

    <!-- Editor content -->
    <editor-content v-if="!showSourceView" :editor="editor" class="tiptap-content" />

    <!-- Source view -->
    <textarea
      v-else
      v-model="sourceContent"
      class="tiptap-source"
      @input="onSourceChange"
      spellcheck="false"
    />

    <!-- Outline panel -->
    <OutlinePanel
      :show="isOutlineOpen"
      :headings="headings"
      :anchor-selector="`#${outlineButtonId}`"
      :active-heading-id="activeHeadingId"
      @close="toggleOutline"
      @navigate="navigateToHeading"
    />
  </div>
</template>

<script setup lang="ts">
import { useActiveHeading } from '@composables/useActiveHeading'
import { useOutline } from '@composables/useOutline'
import { recreateTransform } from '@manuscripts/prosemirror-recreate-steps'
import Dialog from '@renderer/utils/dialog'
import { exportToDocx, saveDocxBlob } from '@services/docx'
import { saveBlobAsFile } from '@services/download'
import { t } from '@services/i18n'
import { exportToPdf, stripLeadingBodyTitle } from '@services/pdf'
import { exportToPptx, savePptxBlob } from '@services/pptx'
import { Extension } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor, type AnyExtension } from '@tiptap/vue-3'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Spinner from '../Spinner.vue'
import LinkEditor from './LinkEditor.vue'
import OutlinePanel from './OutlinePanel.vue'
import TiptapToolbar from './TiptapToolbar.vue'
import TiptapTableToolbar from './TiptapTableToolbar.vue'
import { getExportFilename } from '../../utils/path_utils'


const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  readOnly: {
    type: Boolean,
    default: false
  },
  filePath: {
    type: String,
    default: ''
  },
  isMarpFile: {
    type: Boolean,
    default: false
  },
  isMerging: {
    type: Boolean,
    default: false
  },
  showMarpControls: {
    type: Boolean,
    default: false
  },
  exportFormats: {
    type: Array as () => string[],
    default: (): string[] => [],
  },
  showOutline: {
    type: Boolean,
    default: true
  },
  showSourceToggle: {
    type: Boolean,
    default: true
  },
  showTableControls: {
    type: Boolean,
    default: true
  },
  showAlignmentControls: {
    type: Boolean,
    default: true
  },
  placeholder: {
    type: String,
    default: ''
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'switch-to-slideshow'])

// View mode state - Marp files always start in source view
const showSourceView = ref(props.isMarpFile)
const sourceContent = ref(props.modelValue)

// Track if cursor is in a table
const isInTable = ref(false)

// Track saved selection for when editor loses focus
const savedSelection = ref<{ from: number, to: number } | null>(null)

// Track if we're loading initial content to prevent false change detection
let isInitialLoad = true

// Link editor
const linkEditor = ref(null)

// Toggle between source and WYSIWYG view
const toggleViewMode = () => {
  if (showSourceView.value) {
    // Switching from source to WYSIWYG
    // Update editor content from source
    if (editor.value) {
      editor.value.commands.setContent(sourceContent.value, { contentType: 'markdown' })
    }
  } else {
    // Switching from WYSIWYG to source
    // Update source content from editor
    if (editor.value) {
      sourceContent.value = editor.value.getMarkdown()
    }
  }
  showSourceView.value = !showSourceView.value
}

// Handle source view changes
const onSourceChange = () => {
  emit('update:modelValue', sourceContent.value)
}

// Set/edit link
const setLink = () => {
  if (!editor.value) return

  const { from, to } = editor.value.state.selection
  const previousUrl = editor.value.getAttributes('link').href

  // Get selected text or expand to link mark if we're inside a link
  let selectedText = ''
  if (previousUrl) {
    // We're on a link - expand selection to the full link mark
    editor.value.chain().focus().extendMarkRange('link').run()
    const { from: newFrom, to: newTo } = editor.value.state.selection
    selectedText = editor.value.state.doc.textBetween(newFrom, newTo, '')
  } else {
    // Just get the selection
    selectedText = editor.value.state.doc.textBetween(from, to, '')
  }

  // Show link editor dialog
  linkEditor.value?.show(selectedText, previousUrl)
}

const onLinkSave = ({ text, url }: { text: string; url: string }) => {
  if (!editor.value) return

  const { from, to } = editor.value.state.selection
  const hasSelection = from !== to
  const isEditingLink = editor.value.isActive('link')

  if (isEditingLink && hasSelection) {
    // Editing existing link: replace the selected text and update URL
    editor.value
      .chain()
      .focus()
      .deleteSelection()
      .insertContent([
        {
          type: 'text',
          text: text || url,
          marks: [{ type: 'link', attrs: { href: url } }],
        },
      ])
      .run()
  } else if (hasSelection) {
    // Has selection but not a link: just set the link on selected text
    editor.value.chain().focus().setLink({ href: url }).run()
  } else if (text) {
    // No selection but text provided: insert new link
    editor.value
      .chain()
      .focus()
      .insertContent([
        {
          type: 'text',
          text: text,
          marks: [{ type: 'link', attrs: { href: url } }],
        },
      ])
      .run()
  } else {
    // No selection and no text: just insert the URL as linked text
    editor.value
      .chain()
      .focus()
      .insertContent([
        {
          type: 'text',
          text: url,
          marks: [{ type: 'link', attrs: { href: url } }],
        },
      ])
      .run()
  }
}

const onLinkRemove = () => {
  if (!editor.value) return
  editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
}

// Get markdown content for export
const getMarkdownContent = () => {
  if (showSourceView.value) {
    return sourceContent.value
  }
  return editor.value?.getMarkdown() || props.modelValue
}

// Export document in the specified format
const exportDocument = async (format: string) => {
  try {
    const content = getMarkdownContent()
    const filename = getExportFilename(props.filePath, 'document')

    switch (format) {
      case 'md': {
        const blob = new Blob([content], { type: 'text/markdown' })
        saveBlobAsFile(blob, filename, 'md')
        break
      }
      case 'pdf': {
        const container = document.createElement('div')
        container.classList.add('text')
        container.setAttribute('data-pdf-profile', 'editor')
        container.innerHTML = window.api.markdown.render(content)
        stripLeadingBodyTitle(container, filename)
        await exportToPdf({ title: filename, element: container })
        break
      }
      case 'pptx': {
        const blob = await exportToPptx({ title: filename, content, isMarp: true })
        savePptxBlob(blob, filename)
        break
      }
      case 'docx':
      default: {
        const blob = await exportToDocx({ title: filename, content })
        saveDocxBlob(blob, filename)
        break
      }
    }
  } catch (error) {
    console.error('Failed to export document:', error)
    Dialog.alert(t('playbooks.editor.exportError'))
  }
}

// Extension to show selection highlight when editor is blurred
const blurSelectionPluginKey = new PluginKey('blurSelection')
const BlurSelection = Extension.create({
  name: 'blurSelection',
  addProseMirrorPlugins() {
    let hasFocus = true
    return [
      new Plugin({
        key: blurSelectionPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, decorationSet, oldState, newState) => {
            if (hasFocus) return DecorationSet.empty
            const { from, to } = newState.selection
            if (from === to) return DecorationSet.empty

            return DecorationSet.create(newState.doc, [
              Decoration.inline(from, to, { class: 'blur-selection' }),
            ])
          },
        },
        props: {
          decorations(state) {
            return blurSelectionPluginKey.getState(state) as DecorationSet
          },
          handleDOMEvents: {
            focus: (view) => {
              hasFocus = true
              view.dispatch(view.state.tr)
              return false
            },
            blur: (view) => {
              hasFocus = false
              view.dispatch(view.state.tr)
              return false
            },
          },
        },
      }),
    ]
  },
})

// Build editor extensions
// Note: Content syncs via REST API + SSE, not Y.Doc
const getExtensions = (): AnyExtension[] => {
  return [
    StarterKit.configure({
      // Disable autolink in the Link extension included in StarterKit
      // This prevents "PLAYBOOK.md" or "CLAUDE.md" from becoming auto-linked URLs
      link: {
        autolink: false,
      },
    }),
    Markdown,
    Highlight,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    BlurSelection,
    ...(props.placeholder ? [Placeholder.configure({ placeholder: props.placeholder })] : []),
  ]
}

// Create editor instance
// Note: Content syncs via REST API, not Y.Doc. We always set initial content.
const editor = useEditor({
  content: props.modelValue,
  contentType: 'markdown',
  editable: !props.readOnly,
  extensions: getExtensions(),
  editorProps: {
    attributes: {
      class: 'prose prose-sm max-w-none focus:outline-none',
    },
    handleClick: (view, pos, event) => {
      // Prevent link opening on click - only allow Cmd/Ctrl+click
      const target = event.target as HTMLElement
      if (target.tagName === 'A' && !(event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        return true // Handled
      }
      return false // Not handled
    },
  },
  onUpdate: ({ editor }) => {
    // Skip emitting during initial load to prevent false change detection
    if (isInitialLoad) {
      isInitialLoad = false
      return
    }

    // Get markdown content using the editor method
    const markdown = editor.getMarkdown()
    // Only emit if content actually changed (not just selection/focus)
    if (markdown !== props.modelValue) {
      emit('update:modelValue', markdown)
    }

    // Update table context
    isInTable.value = editor.isActive('table')
  },
  onSelectionUpdate: ({ editor }) => {
    // Update table context when cursor moves
    isInTable.value = editor.isActive('table')
  },
  onBlur: ({ editor }) => {
    // Save selection when editor loses focus
    const { from, to } = editor.state.selection
    if (from !== to) {
      savedSelection.value = { from, to }
    } else {
      savedSelection.value = null
    }
  },
  onFocus: () => {
    // Clear saved selection when editor regains focus
    savedSelection.value = null
  },
})

// Initialize outline composable
const { headings, isOutlineOpen, toggleOutline, navigateToHeading } = useOutline(editor)

// Initialize active heading tracking
const { activeHeadingId } = useActiveHeading(editor, headings, isOutlineOpen)

// Unique ID for positioning the outline panel
const outlineButtonId = computed(() => `outline-btn-${Math.random().toString(36).substr(2, 9)}`)

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  // Update source content
  sourceContent.value = newValue

  // Update editor if not in source view
  if (editor.value && !showSourceView.value) {
    const currentMarkdown = editor.value.getMarkdown()
    if (newValue !== currentMarkdown) {
      // Mark as initial load when setting new content to prevent onUpdate from firing
      isInitialLoad = true

      // Preserve cursor position by using recreateTransform to compute steps
      // instead of setContent which destroys and rebuilds the document
      try {
        const oldDoc = editor.value.state.doc

        // Parse new markdown to ProseMirror JSON, then to a Node
        const newJson = editor.value.markdown.parse(newValue)
        const newDoc = editor.value.schema.nodeFromJSON(newJson)

        // Get transform steps from old doc to new doc
        const transform = recreateTransform(oldDoc, newDoc, true, true)

        // Apply the steps as a transaction (cursor position is automatically mapped)
        if (transform.steps.length > 0) {
          const tr = editor.value.state.tr
          transform.steps.forEach((step) => {
            tr.step(step)
          })
          editor.value.view.dispatch(tr)
        }
      } catch (error) {
        // Fallback to setContent if recreateTransform fails
        console.warn('recreateTransform failed, falling back to setContent:', error)
        editor.value.commands.setContent(newValue, { contentType: 'markdown' })
      }
    }
  }
})

// Watch for readOnly changes
watch(() => props.readOnly, (newValue) => {
  if (editor.value) {
    editor.value.setEditable(!newValue && !props.isMerging)
  }
})

// Watch for isMerging changes - disable editing during merge
watch(() => props.isMerging, (newValue) => {
  if (editor.value) {
    editor.value.setEditable(!newValue && !props.readOnly)
  }
})

// Cleanup
onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})

// Get the markdown content of the current selection
const getSelectedMarkdown = (): { markdown: string, from: number, to: number } | null => {
  if (!editor.value) return null
  const saved = savedSelection.value
  const { from, to } = saved ?? editor.value.state.selection
  if (from === to) return null
  const slice = editor.value.state.doc.slice(from, to)
  const json = { type: 'doc', content: slice.content.toJSON() }
  const markdown = editor.value.markdown?.serialize(json) || editor.value.state.doc.textBetween(from, to, '\n')
  return { markdown, from, to }
}

// Select a range in the editor by markdown character offsets
const selectMarkdownRange = (mdFrom: number, mdTo: number) => {
  if (!editor.value?.markdown) return
  const fullMarkdown = editor.value.getMarkdown()
  const targetMarkdown = fullMarkdown.substring(mdFrom, mdTo)
  if (!targetMarkdown) return

  // Parse target to a ProseMirror node to get its text content
  const targetJson = editor.value.markdown.parse(targetMarkdown)
  const targetDoc = editor.value.schema.nodeFromJSON(targetJson)
  const targetText = targetDoc.textContent
  if (!targetText) return

  // Parse before-markdown to get the preceding text content length
  const beforeMarkdown = fullMarkdown.substring(0, mdFrom)
  let precedingTextLen = 0
  if (beforeMarkdown.length > 0) {
    const beforeJson = editor.value.markdown.parse(beforeMarkdown)
    const beforeDoc = editor.value.schema.nodeFromJSON(beforeJson)
    precedingTextLen = beforeDoc.textContent.length
  }

  // Walk the document to find ProseMirror positions matching text offsets
  const doc = editor.value.state.doc
  let charCount = 0
  let pmFrom = -1
  let pmTo = -1

  doc.descendants((node, pos) => {
    if (pmTo !== -1) return false
    if (!node.isText) return true
    const text = node.text!
    for (let i = 0; i < text.length; i++) {
      if (charCount === precedingTextLen && pmFrom === -1) {
        pmFrom = pos + i
      }
      charCount++
      if (charCount === precedingTextLen + targetText.length && pmTo === -1) {
        pmTo = pos + i + 1
      }
    }
    return true
  })

  if (pmFrom !== -1 && pmTo !== -1) {
    editor.value.commands.setTextSelection({ from: pmFrom, to: pmTo })
  }
}

// Replace the current selection with new markdown content
const replaceSelection = (markdown: string) => {
  if (!editor.value?.markdown) return
  const saved = savedSelection.value
  let { from, to } = saved ?? editor.value.state.selection

  const doc = editor.value.state.doc

  // if selection covers the entire document, use setContent for a clean replace
  if (from === 0 || (from === 1 && to === doc.content.size - 1)) {
    editor.value.commands.setContent(markdown, { emitUpdate: false })
    return
  }

  const $from = doc.resolve(from)
  const $to = doc.resolve(to)

  // expand selection to the nearest common block-level ancestor boundaries
  // so we replace full structural nodes, not partial content inside them
  const sharedDepth = $from.sharedDepth(to)

  // expand from/to to cover full nodes at sharedDepth + 1
  if ($from.depth > sharedDepth) {
    from = $from.before(sharedDepth + 1)
  }
  if ($to.depth > sharedDepth) {
    to = $to.after(sharedDepth + 1)
  }

  // parse replacement markdown into ProseMirror content
  const json = editor.value.markdown.parse(markdown)
  const replacement = editor.value.schema.nodeFromJSON(json)

  // determine what to insert: if the replacement's top-level node type
  // matches the parent at the insertion point, unwrap to avoid nesting
  // e.g. inserting bulletList items inside an existing bulletList
  const $insertAt = doc.resolve(from)
  const parentType = $insertAt.parent.type.name
  let content = replacement.content
  if (replacement.content.childCount === 1) {
    const child = replacement.content.child(0)
    if (child.type.name === parentType) {
      content = child.content
    }
  }

  const tr = editor.value.state.tr.replaceWith(from, to, content)
  editor.value.view.dispatch(tr)
}

// Expose editor instance and saved selection for parent components
defineExpose({ editor, savedSelection, getSelectedMarkdown, selectMarkdownRange, replaceSelection })
</script>

<style scoped>
.tiptap-editor-wrapper {
  position: relative;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--background-color);
}

/* Toolbars */
.tiptap-toolbars {
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-outline-variant);
  margin-bottom: 1rem;
}

/* Editor content */
.tiptap-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-8);
  padding-left: var(--space-12);
}

/* Tiptap editor styles */
.tiptap-content :deep(.tiptap) {
  outline: none;
  color: var(--color-on-surface);
  font-family: var(--sp-font-family, var(--font-family-base));
  font-size: var(--sp-font-size, var(--font-size-16));
  line-height: var(--line-height-24);
}

.tiptap-content :deep(.tiptap) * {
  font-family: var(--sp-font-family, var(--font-family-base));
}

/* Blur selection highlight */
.tiptap-content :deep(.tiptap .blur-selection) {
  background-color: rgb(180, 215, 254);
  color: var(--text-color);
}

.tiptap-content :deep(.tiptap h1 .blur-selection),
.tiptap-content :deep(.tiptap h2 .blur-selection),
.tiptap-content :deep(.tiptap h3 .blur-selection),
.tiptap-content :deep(.tiptap h4 .blur-selection) {
  padding-right: 6px;
}

.tiptap-content :deep(.tiptap h2 .blur-selection),
.tiptap-content :deep(.tiptap h3 .blur-selection),
.tiptap-content :deep(.tiptap h4 .blur-selection) {
  padding-top: 1px;
  padding-bottom: 1px;
}

.tiptap-content :deep(.tiptap p .blur-selection:last-child) {
  padding-top: 2.5px;
  padding-bottom: 2.5px;
}

.tiptap-content :deep(.tiptap p > .blur-selection:last-child) {
  padding-right: 5px;
}

@media (prefers-color-scheme: dark) {
  .tiptap-content :deep(.tiptap .blur-selection) {
    background-color: rgb(84, 126, 171);
  }
}

/* Placeholder */
.tiptap-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  position: relative;
  top: 128px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--color-on-surface-variant);
  font-size: 1.25em;
  line-height: 1.66rem;
  text-align: center;
  pointer-events: none;
  height: 0;
}

/* Headings */
.tiptap-content :deep(.tiptap h1) {
  font-size: var(--font-size-28);
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  margin-top: var(--space-16);
  margin-bottom: var(--space-8);
}

.tiptap-content :deep(.tiptap h2) {
  font-size: var(--font-size-24);
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
  margin-top: var(--space-12);
  margin-bottom: var(--space-6);
}

.tiptap-content :deep(.tiptap h3) {
  font-size: var(--font-size-20);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
  margin-top: var(--space-12);
  margin-bottom: var(--space-6);
}

.tiptap-content :deep(.tiptap h4) {
  font-size: var(--font-size-18);
  font-weight: var(--font-weight-medium);
  line-height: 1.4;
  margin-top: var(--space-8);
  margin-bottom: var(--space-6);
}

/* Paragraphs */
.tiptap-content :deep(.tiptap p) {
  margin-top: var(--sp-spacing, var(--space-6));
  margin-bottom: var(--sp-spacing, var(--space-6));
}

/* Lists */
.tiptap-content :deep(.tiptap ul),
.tiptap-content :deep(.tiptap ol) {
  padding-left: var(--space-8);
  margin-top: var(--sp-spacing, var(--space-6));
  margin-bottom: var(--sp-spacing, var(--space-6));
}

.tiptap-content :deep(.tiptap li) {
  margin-top: var(--space-4);
  margin-bottom: var(--space-4);
}

.tiptap-content :deep(.tiptap > :first-child) {
  margin-top: 0;
}

/* Task lists */
.tiptap-content :deep(.tiptap ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
}

.tiptap-content :deep(.tiptap ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.tiptap-content :deep(.tiptap ul[data-type="taskList"] li input[type="checkbox"]) {
  margin-top: 0.35em;
  cursor: pointer;
}

/* Code */
.tiptap-content :deep(.tiptap code) {
  font-family: 'SF Mono', Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
  padding: 0.125em 0.25em;
  background-color: var(--color-surface-low);
  border-radius: var(--radius-sm);
  color: var(--color-on-surface);
}

.tiptap-content :deep(.tiptap pre) {
  font-family: 'SF Mono', Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  background-color: var(--color-surface-low);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  margin-top: var(--space-8);
  margin-bottom: var(--space-8);
  overflow-x: auto;
}

.tiptap-content :deep(.tiptap pre code) {
  display: inline-block;
  font-size: var(--font-size-13);
  line-height: var(--line-height-18);
}

/* Blockquotes */
.tiptap-content :deep(.tiptap blockquote) {
  border-left: 3px solid var(--color-outline);
  padding-left: var(--space-4);
  margin-left: 0;
  margin-top: var(--space-8);
  margin-bottom: var(--space-8);
  color: var(--color-on-surface-variant);
  font-style: italic;
}

/* Horizontal rule */
.tiptap-content :deep(.tiptap hr) {
  border: none;
  border-top: 2px solid var(--color-outline-variant);
  margin-top: var(--space-16);
  margin-bottom: var(--space-16);
}

/* Tables */
.tiptap-content :deep(.tiptap table) {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  margin-top: var(--sp-spacing, var(--space-8));
  margin-bottom: var(--sp-spacing, var(--space-8));
  overflow: hidden;
}

.tiptap-content :deep(.tiptap table td),
.tiptap-content :deep(.tiptap table th) {
  min-width: 1em;
  border: 1px solid var(--color-outline-variant);
  padding: var(--sp-spacing, var(--space-2)) calc(2 * var(--sp-spacing, var(--space-2)));
  vertical-align: top;
  box-sizing: border-box;
  position: relative;
}

.tiptap-content :deep(.tiptap table th) {
  font-weight: var(--font-weight-semibold);
  text-align: left;
  background-color: var(--color-surface-low);
}

.tiptap-content :deep(.tiptap table .selectedCell:after) {
  z-index: 2;
  position: absolute;
  content: "";
  left: 0; right: 0; top: 0; bottom: 0;
  background: var(--color-primary);
  opacity: 0.1;
  pointer-events: none;
}

.tiptap-content :deep(.tiptap table .column-resize-handle) {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: -2px;
  width: 4px;
  background-color: var(--color-primary);
  pointer-events: none;
}

/* Links */
.tiptap-content :deep(.tiptap a) {
  color: var(--color-primary);
  text-decoration: none;
  cursor: text;
}

/* Task list checkboxes */
.tiptap-content :deep(.tiptap ul[data-type="taskList"] li) {
  padding-left: 1rem;
  display: flex;
  align-items: center;
}

/* Scrollbar */
.tiptap-content::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tiptap-content::-webkit-scrollbar-track {
  background: var(--color-surface-low);
}

.tiptap-content::-webkit-scrollbar-thumb {
  background: var(--color-outline-variant);
  border-radius: var(--radius-sm);
}

.tiptap-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-outline);
}

/* Source view */
.tiptap-source {
  flex: 1;
  width: 100%;
  padding: var(--space-8);
  font-family: 'SF Mono', Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  font-size: var(--font-size-12);
  line-height: 1.6;
  color: var(--color-on-surface);
  background-color: var(--color-surface);
  border: none;
  resize: none;
  outline: none;
  overflow-y: auto;
}

.tiptap-source::placeholder {
  color: var(--color-on-surface-variant);
}

/* Scrollbar for source view */
.tiptap-source::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tiptap-source::-webkit-scrollbar-track {
  background: var(--color-surface-low);
}

.tiptap-source::-webkit-scrollbar-thumb {
  background: var(--color-outline-variant);
  border-radius: var(--radius-sm);
}

.tiptap-source::-webkit-scrollbar-thumb:hover {
  background: var(--color-outline);
}

/* Merge overlay */
.merge-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(var(--color-surface-rgb, 255, 255, 255), 0.7);
  z-index: 100;
}

.merge-spinner {
  animation: spin 1s linear infinite;
  color: var(--color-primary);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Merge overlay transition */
.merge-overlay-enter-active,
.merge-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.merge-overlay-enter-from,
.merge-overlay-leave-to {
  opacity: 0;
}

</style>
