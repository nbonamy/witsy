<template>
  <ScrollContainer direction="horizontal" :scroll-amount="100">
    <div class="tiptap-toolbar">
      <!-- Slideshow button (Marp files only) -->
      <ButtonIcon
        v-if="showMarpControls"
        @click="emit('switch-to-slideshow')"
        v-tooltip="{ text: t('playbooks.marp.viewSlideshow'), position: 'bottom' }"
      >
        <PlayIcon :size="16" />
      </ButtonIcon>

      <!-- View mode toggle (non-Marp files) -->
      <ButtonIcon
        v-if="showSourceToggle && !(showMarpControls)"
        @click="emit('toggle-view-mode')"
        :active="showSourceView"
        v-tooltip="{ text: showSourceView ? 'Switch to WYSIWYG view' : 'Switch to source view', position: 'bottom' }"
      >
        <Code2Icon v-if="showSourceView" :size="16" />
        <EyeIcon v-else :size="16" />
      </ButtonIcon>

      <!-- Outline toggle -->
      <ButtonIcon
        v-if="showOutline"
        :id="outlineButtonId"
        @click="emit('toggle-outline')"
        :active="isOutlineOpen"
        :disabled="showSourceView"
        v-tooltip="{ text: 'Document outline', position: 'bottom' }"
      >
        <ListTreeIcon :size="16" />
      </ButtonIcon>

      <div class="toolbar-separator"></div>

      <!-- Undo/Redo -->
      <ButtonIcon
        @click="editor.chain().focus().undo().run()"
        :disabled="showSourceView || !editor.can().undo()"
        v-tooltip="{ text: 'Undo (Cmd+Z)', position: 'bottom' }"
      >
        <UndoIcon :size="16" />
      </ButtonIcon>
      <ButtonIcon
        @click="editor.chain().focus().redo().run()"
        :disabled="showSourceView || !editor.can().redo()"
        v-tooltip="{ text: 'Redo (Cmd+Shift+Z)', position: 'bottom' }"
      >
        <RedoIcon :size="16" />
      </ButtonIcon>

      <div class="toolbar-separator"></div>

      <!-- Heading menu -->
      <ContextMenuTrigger class="menu" position="below" :disabled="showSourceView">
        <template #trigger>
          <HeadingIcon :size="16" />
          <ChevronDownIcon :size="16" />
        </template>
        <template #menu>
          <div class="item" @click="editor.chain().focus().setParagraph().run()">
            Paragraph
          </div>
          <div class="item" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()">
            <Heading1Icon :size="16" /> Heading 1
          </div>
          <div class="item" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">
            <Heading2Icon :size="16" /> Heading 2
          </div>
          <div class="item" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">
            <Heading3Icon :size="16" /> Heading 3
          </div>
          <div class="item" @click="editor.chain().focus().toggleHeading({ level: 4 }).run()">
            <Heading4Icon :size="16" /> Heading 4
          </div>
        </template>
      </ContextMenuTrigger>

      <!-- List menu -->
      <ContextMenuTrigger class="menu" position="below" :disabled="showSourceView">
        <template #trigger>
          <ListIcon :size="16" />
          <ChevronDownIcon :size="16" />
        </template>
        <template #menu>
          <div class="item" @click="editor.chain().focus().toggleBulletList().run()">
            <ListIcon :size="16" /> Bullet list
          </div>
          <div class="item" @click="editor.chain().focus().toggleOrderedList().run()">
            <ListOrderedIcon :size="16" /> Numbered list
          </div>
          <div class="item" @click="editor.chain().focus().toggleTaskList().run()">
            <ListTodoIcon :size="16" /> Task list
          </div>
        </template>
      </ContextMenuTrigger>

      <!-- Code block -->
      <ButtonIcon
        @click="editor.chain().focus().toggleCodeBlock().run()"
        :active="editor.isActive('codeBlock')"
        :disabled="showSourceView"
        v-tooltip="{ text: 'Code block', position: 'bottom' }"
      >
        <SquareCodeIcon :size="16" />
      </ButtonIcon>

      <!-- Insert Table -->
      <ButtonIcon
        v-if="showTableControls"
        @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
        :disabled="showSourceView"
        v-tooltip="{ text: 'Insert table (3x3)', position: 'bottom' }"
      >
        <Grid2x2Icon :size="16" />
      </ButtonIcon>

      <div class="toolbar-separator"></div>

      <!-- Text formatting -->
      <ButtonIcon
        @click="editor.chain().focus().toggleBold().run()"
        :active="editor.isActive('bold')"
        :disabled="showSourceView"
        v-tooltip="{ text: 'Bold (Cmd+B)', position: 'bottom' }"
      >
        <BoldIcon :size="16" />
      </ButtonIcon>
      <ButtonIcon
        @click="editor.chain().focus().toggleItalic().run()"
        :active="editor.isActive('italic')"
        :disabled="showSourceView"
        v-tooltip="{ text: 'Italic (Cmd+I)', position: 'bottom' }"
      >
        <ItalicIcon :size="16" />
      </ButtonIcon>
      <ButtonIcon
        @click="editor.chain().focus().toggleUnderline().run()"
        :active="editor.isActive('underline')"
        :disabled="showSourceView"
        v-tooltip="{ text: 'Underline', position: 'bottom' }"
      >
        <UnderlineIcon :size="16" />
      </ButtonIcon>
      <ButtonIcon
        @click="editor.chain().focus().toggleStrike().run()"
        :active="editor.isActive('strike')"
        :disabled="showSourceView"
        v-tooltip="{ text: 'Strikethrough', position: 'bottom' }"
      >
        <StrikethroughIcon :size="16" />
      </ButtonIcon>
      <ButtonIcon
        @click="editor.chain().focus().toggleCode().run()"
        :active="editor.isActive('code')"
        :disabled="showSourceView"
        v-tooltip="{ text: 'Inline code', position: 'bottom' }"
      >
        <CodeXmlIcon :size="16" />
      </ButtonIcon>
      <ButtonIcon
        @click="emit('set-link')"
        :active="editor.isActive('link')"
        :disabled="showSourceView"
        v-tooltip="{ text: 'Insert/edit link', position: 'bottom' }"
      >
        <LinkIcon :size="16" />
      </ButtonIcon>
      <ButtonIcon
        @click="editor.chain().focus().toggleHighlight().run()"
        :active="editor.isActive('highlight')"
        :disabled="showSourceView"
        v-tooltip="{ text: 'Highlight', position: 'bottom' }"
      >
        <HighlighterIcon :size="16" />
      </ButtonIcon>

      <template v-if="showAlignmentControls">
        <div class="toolbar-separator"></div>

        <!-- Text alignment -->
        <ButtonIcon
          @click="editor.chain().focus().setTextAlign('left').run()"
          :active="editor.isActive({ textAlign: 'left' })"
          :disabled="showSourceView"
          v-tooltip="{ text: 'Align left', position: 'bottom' }"
        >
          <AlignLeftIcon :size="16" />
        </ButtonIcon>
        <ButtonIcon
          @click="editor.chain().focus().setTextAlign('center').run()"
          :active="editor.isActive({ textAlign: 'center' })"
          :disabled="showSourceView"
          v-tooltip="{ text: 'Align center', position: 'bottom' }"
        >
          <AlignCenterIcon :size="16" />
        </ButtonIcon>
        <ButtonIcon
          @click="editor.chain().focus().setTextAlign('right').run()"
          :active="editor.isActive({ textAlign: 'right' })"
          :disabled="showSourceView"
          v-tooltip="{ text: 'Align right', position: 'bottom' }"
        >
          <AlignRightIcon :size="16" />
        </ButtonIcon>
        <ButtonIcon
          @click="editor.chain().focus().setTextAlign('justify').run()"
          :active="editor.isActive({ textAlign: 'justify' })"
          :disabled="showSourceView"
          v-tooltip="{ text: 'Justify', position: 'bottom' }"
        >
          <AlignJustifyIcon :size="16" />
        </ButtonIcon>
      </template>

      <template v-if="exportFormats.length > 0">
        <div class="toolbar-separator"></div>

        <!-- Export -->
        <ButtonIcon
          :id="exportButtonId"
          @click="onExportClick"
          v-tooltip="{ text: exportTooltip, position: 'bottom' }"
        >
          <DownloadIcon :size="16" />
        </ButtonIcon>
        <ContextMenuPlus
          v-if="showExportMenu"
          :anchor="`#${exportButtonId}`"
          position="below"
          :auto-close="true"
          @close="showExportMenu = false"
        >
          <div v-for="fmt in exportFormats" :key="fmt" class="item" @click="emit('export-document', fmt)">
            <DownloadIcon class="icon" />
            <span>{{ exportFormatLabel(fmt) }}</span>
          </div>
        </ContextMenuPlus>
      </template>
    </div>
  </ScrollContainer>
</template>

<script setup lang="ts">
import ButtonIcon from '@components/ButtonIcon.vue'
import ContextMenuPlus from '@components/ContextMenuPlus.vue'
import ContextMenuTrigger from '@components/ContextMenuTrigger.vue'
import ScrollContainer from '@components/ScrollContainer.vue'
import { t } from '@services/i18n'
import type { Editor } from '@tiptap/vue-3'
import { computed, ref } from 'vue'
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ChevronDownIcon,
  Code2Icon,
  CodeXmlIcon,
  DownloadIcon,
  EyeIcon,
  Grid2x2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  HeadingIcon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  ListTreeIcon,
  PlayIcon,
  RedoIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
  UndoIcon
} from 'lucide-vue-next'

const props = defineProps({
  editor: {
    type: Object as () => Editor,
    required: true,
  },
  showSourceView: {
    type: Boolean,
    default: false,
  },
  showMarpControls: {
    type: Boolean,
    default: false,
  },
  showSourceToggle: {
    type: Boolean,
    default: true,
  },
  showOutline: {
    type: Boolean,
    default: true,
  },
  showTableControls: {
    type: Boolean,
    default: true,
  },
  showAlignmentControls: {
    type: Boolean,
    default: true,
  },
  exportFormats: {
    type: Array as () => string[],
    default: (): string[] => [],
  },
  isOutlineOpen: {
    type: Boolean,
    default: false,
  },
  outlineButtonId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'switch-to-slideshow',
  'toggle-view-mode',
  'toggle-outline',
  'set-link',
  'export-document',
])

// Generate a unique id for the export button anchor
const exportButtonId = computed(() => `export-btn-${Math.random().toString(36).slice(2, 8)}`)
const showExportMenu = ref(false)

const exportFormatLabels: Record<string, string> = {
  md: 'Markdown (.md)',
  pdf: 'PDF (.pdf)',
  docx: 'Word (.docx)',
  pptx: 'PowerPoint (.pptx)',
}

const exportFormatLabel = (fmt: string) => exportFormatLabels[fmt] || fmt

const exportTooltip = computed(() => {
  const formats = props.exportFormats
  if (formats.length === 1) return exportFormatLabels[formats[0]] || t('common.export')
  return t('common.export')
})

const onExportClick = () => {
  const formats = props.exportFormats
  if (formats.length === 1) {
    emit('export-document', formats[0])
  } else {
    showExportMenu.value = !showExportMenu.value
  }
}
</script>

<style scoped>
.tiptap-toolbar {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);

  svg {
    width: var(--icon-lg);
    height: var(--icon-lg);
  }
}

.toolbar-separator {
  flex-shrink: 0;
  width: 1px;
  height: 24px;
  background-color: var(--color-outline-variant);
  margin: 0 var(--space-2);
}

.tiptap-toolbar :deep(.button-icon[active=true]) {
  background-color: var(--color-primary);
  svg {
    stroke: var(--color-on-primary);
  }
}
</style>
