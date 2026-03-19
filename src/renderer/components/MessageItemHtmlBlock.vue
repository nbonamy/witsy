<template>
  <div class="artifact panel">
    <div class="panel-header">
      <ChevronDownIcon class="icon toggle" @click.stop="togglePanel" />
      <label>{{ title }}</label>
      <ButtonIcon class="preview" @click="toggleHtml">
        <ScanEyeIcon v-if="!previewHtml" />
        <EyeOffIcon v-else />
      </ButtonIcon>
      <ButtonIcon>
        <ClipboardCheckIcon v-if="copying" />
        <ClipboardIcon @click="onCopy" v-else />
      </ButtonIcon>
      <ContextMenuTrigger class="download" position="below-right">
        <template #trigger>
          <DownloadIcon />
        </template>
        <template #menu>
          <div class="item" @click="onDownloadFormat('raw')">HTML</div>
          <div class="item" @click="onDownloadFormat('pdf')">PDF</div>
        </template>
      </ContextMenuTrigger>
    </div>
    <div class="panel-body variable-font-size" ref="panelBody">
      <MessageItemBody v-if="!previewHtml" :message="message" show-tool-calls="never" />
      <iframe ref="htmlIframe" sandbox="allow-scripts allow-same-origin allow-forms" v-else-if="!transient || headComplete" :srcdoc="html" style="width: 100%; border: none;" />
      <div v-else class="html-loading">{{ t('common.htmlGeneration') }}</div>
    </div>

  </div>
</template>

<script setup lang="ts">

import { useArtifactCopy } from '@composables/artifact_copy'
import useEventListener from '@composables/event_listener'
import Message from '@models/message'
import { togglePanel } from '@renderer/utils/panel'
import { t } from '@services/i18n'
import { addExtension, extractCodeBlockContent, extractHtmlContent as extractHtml } from '@services/markdown'
import { exportToPdf } from '@services/pdf'
import { store } from '@services/store'
import { ChevronDownIcon, ClipboardCheckIcon, ClipboardIcon, DownloadIcon, EyeOffIcon, ScanEyeIcon } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ButtonIcon from './ButtonIcon.vue'
import ContextMenuTrigger from './ContextMenuTrigger.vue'
import MessageItemBody from './MessageItemBody.vue'

const content = () => extractCodeBlockContent(props.content)

const { onDomEvent } = useEventListener()
const { copying, onCopy } = useArtifactCopy(content)

const previewHtml = ref(false)
const htmlRenderingDelayPassed = ref(false)
const panelBody = ref<HTMLElement>()
const htmlIframe = ref<HTMLIFrameElement>()
const headComplete = ref(false)
const initialHtmlWithListener = ref('')

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  transient: {
    type: Boolean,
    required: true,
  },
})

const message = computed(() => new Message('assistant', props.content))

const extractHtmlContent = () => extractHtml(props.content)

const extractBodyContent = (htmlContent: string) => {
  const bodyStart = htmlContent.indexOf('<body')
  if (bodyStart === -1) return ''
  const bodyTagEnd = htmlContent.indexOf('>', bodyStart)
  if (bodyTagEnd === -1) return ''
  const bodyEnd = htmlContent.lastIndexOf('</body>')
  if (bodyEnd === -1) return htmlContent.slice(bodyTagEnd + 1)
  return htmlContent.slice(bodyTagEnd + 1, bodyEnd)
}

const isDarkMode = () => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

const resolveCSSVar = (varName: string): string => {
  const el = document.createElement('div')
  document.body.appendChild(el)
  el.style.color = `var(${varName})`
  const resolved = getComputedStyle(el).color
  document.body.removeChild(el)
  return resolved
}

const getDarkModeCSS = () => {
  const bgColor = resolveCSSVar('--background-color')
  const textColor = resolveCSSVar('--color-text')
  return `
    <style>
      html, body {
        background-color: ${bgColor};
        color: ${textColor};
      }
    </style>
    <script>
      (function() {
        function lum(r, g, b) {
          return [r/255, g/255, b/255].reduce(function(s, c, i) {
            c = c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
            return s + c * [0.2126, 0.7152, 0.0722][i];
          }, 0);
        }
        function parseRgb(s) {
          var m = s.match(/[\\d.]+/g);
          if (!m || m.length < 3) return null;
          var nums = m.map(Number);
          if (nums.length >= 4 && nums[3] < 1) return null;
          return nums.slice(0, 3);
        }
        function fixEl(el) {
          var cs = window.getComputedStyle(el);
          var bg = parseRgb(cs.backgroundColor);
          if (!bg) return;
          var textRgb = parseRgb(cs.color);
          if (!textRgb) return;
          var bgLum = lum(bg[0], bg[1], bg[2]);
          var textLum = lum(textRgb[0], textRgb[1], textRgb[2]);
          var brighter = Math.max(bgLum, textLum);
          var darker = Math.min(bgLum, textLum);
          if ((brighter + 0.05) / (darker + 0.05) < 3) {
            el.style.setProperty('color', bgLum > 0.4 ? '#1a1a1a' : '#f0f0f0', 'important');
          }
        }
        window.fixContrast = function() {
          document.querySelectorAll('*').forEach(fixEl);
        };
        document.addEventListener('DOMContentLoaded', function() {
          window.fixContrast();
          document.addEventListener('mouseover', function(e) {
            if (e.target && e.target.nodeType === 1) fixEl(e.target);
          });
        });
      })();
    <\/script>
  `
}

const injectDarkModeCSS = (htmlContent: string) => {
  if (!isDarkMode()) {
    return htmlContent
  }

  const darkModeCSS = getDarkModeCSS()

  // Find the head tag and inject CSS
  const headEndIndex = htmlContent.indexOf('</head>')
  if (headEndIndex !== -1) {
    return htmlContent.substring(0, headEndIndex) + darkModeCSS + htmlContent.substring(headEndIndex)
  }

  // If no head tag, try to inject after opening html tag
  const htmlTagEnd = htmlContent.indexOf('>')
  if (htmlTagEnd !== -1 && htmlContent.substring(0, htmlTagEnd + 1).toLowerCase().includes('<html')) {
    return htmlContent.substring(0, htmlTagEnd + 1) + '<head>' + darkModeCSS + '</head>' + htmlContent.substring(htmlTagEnd + 1)
  }

  // Otherwise, prepend to the content
  return darkModeCSS + htmlContent
}

const html = computed(() => {
  // Non-transient: return full HTML content with dark mode CSS injected
  if (!props.transient) {
    return injectDarkModeCSS(extractHtmlContent())
  }

  // Transient: wait for head to complete
  if (!headComplete.value) {
    return '' // No iframe yet
  }

  // Transient with head complete: return cached HTML with listener (already has CSS injected)
  return initialHtmlWithListener.value
})

const adjustIframeHeight = () => {
  if (!htmlIframe.value || !htmlIframe.value.contentDocument) return

  const offsetHeight = htmlIframe.value.contentDocument.documentElement.offsetHeight
  if (offsetHeight > 0) {
    htmlIframe.value.style.height = offsetHeight + 'px'
  }
}

const updateIframeContent = () => {
  const htmlContent = extractHtmlContent()
  if (!htmlContent) return

  // Check if head is complete (contains </head>)
  if (!headComplete.value && htmlContent.includes('</head>')) {
    const listenerScript = `
  <script type="module">
    window.addEventListener('message', (event) => {
      if (event.data.type === 'update') {
        document.body.innerHTML = event.data.body;
        if (window.fixContrast) window.fixContrast();
      }
    });
  <\/script>
  `

    // Extract everything up to and including </head>
    const headEndIndex = htmlContent.indexOf('</head>') + 7
    const headSection = htmlContent.substring(0, headEndIndex)

    // Inject dark mode CSS and listener before </head> and add empty body
    const darkModeCSS = isDarkMode() ? getDarkModeCSS() : ''
    const htmlWithListener = headSection.replace('</head>', darkModeCSS + listenerScript + '</head>')
    initialHtmlWithListener.value = htmlWithListener + '<body></body></html>'

    headComplete.value = true

    // Adjust height after iframe renders
    setTimeout(() => adjustIframeHeight(), 50)
    return
  }

  // Send body updates via postMessage
  if (headComplete.value) {
    if (!htmlIframe.value || !htmlIframe.value.contentWindow) return

    const bodyContent = extractBodyContent(htmlContent)
    htmlIframe.value.contentWindow.postMessage(
      { type: 'update', body: bodyContent },
      '*'
    )

    // Adjust height after content updates
    setTimeout(() => adjustIframeHeight(), 50)
  }
}

let delayTimeout: NodeJS.Timeout | null = null
let resizeTimeout: NodeJS.Timeout | null = null

const handleResize = () => {
  if (!htmlIframe.value) return
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => adjustIframeHeight(), 100)
}

const setupHtmlDelay = () => {
  if (!props.transient) {
    // Non-transient messages: show HTML immediately
    htmlRenderingDelayPassed.value = true
  } else {
    // Transient messages: reset delay and start timeout
    htmlRenderingDelayPassed.value = false

    // Clear any existing timeout
    if (delayTimeout) {
      clearTimeout(delayTimeout)
    }

    // Start new timeout
    delayTimeout = setTimeout(() => {
      htmlRenderingDelayPassed.value = true
    }, 2000)
  }
}

onMounted(() => {
  previewHtml.value = store.config.appearance.chat.autoPreview.html ?? true
  setupHtmlDelay()

  // Watch content changes for transient messages
  watch(() => props.content, () => {
    if (props.transient) {
      setupHtmlDelay()
      updateIframeContent()
    }
  })

  // Watch transient state changes
  watch(() => props.transient, (newTransient) => {
    if (!newTransient) {
      // Message is no longer transient (streaming completed)
      // Clear any pending timeout and show HTML immediately
      if (delayTimeout) {
        clearTimeout(delayTimeout)
        delayTimeout = null
      }
      htmlRenderingDelayPassed.value = true
      // Adjust height for non-transient HTML
      setTimeout(() => adjustIframeHeight(), 100)
    } else {
      // Message became transient (shouldn't happen normally, but handle it)
      setupHtmlDelay()
    }
  })

  // Watch for iframe to appear (for non-transient messages)
  watch(htmlIframe, (newIframe) => {
    if (newIframe && !props.transient) {
      // Adjust height after iframe loads
      setTimeout(() => adjustIframeHeight(), 100)
    }
  })

  // For non-transient messages on mount
  if (!props.transient) {
    setTimeout(() => adjustIframeHeight(), 100)
  }

  // Adjust height on window resize (with debounce)
  onDomEvent(window, 'resize', handleResize)
})

onBeforeUnmount(() => {
  if (delayTimeout) clearTimeout(delayTimeout)
  if (resizeTimeout) clearTimeout(resizeTimeout)
})

const toggleHtml = () => {
  previewHtml.value = !previewHtml.value
}

const onDownloadFormat = async (action: string) => {

  let filename = props.title
  let fileContent = ''

  switch (action) {
    case 'raw':
      fileContent = content()
      filename = addExtension(filename, '.html')
      break

    case 'pdf':
      try {
        // For HTML content, export the iframe content directly
        if (previewHtml.value) {
          const iframe = panelBody.value?.querySelector('iframe') as HTMLIFrameElement
          if (!iframe) {
            console.error('Could not find iframe element')
            return
          }

          // Get the actual HTML document from inside the iframe
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
          if (!iframeDoc) {
            console.error('Could not access iframe content')
            return
          }

          // Export the entire HTML document from the iframe
          await exportToPdf({
            title: filename.replace(/\.[^.]+$/, ''),
            element: iframeDoc.documentElement, // This gets the <html> element with all its content
          })

          return
        }
      } catch (error) {
        console.error('Failed to generate PDF:', error)
        return
      }

      // exportToPdf is already doing the save
      return
  }

  // Save file using the API for text and markdown
  window.api.file.save({
    contents: window.api.base64.encode(fileContent),
    properties: {
      filename,
      prompt: true
    }
  })
}

</script>

<style scoped>

.panel {
  .panel-body:has(.html-loading) {
    min-height: 300px;
  }
}

</style>