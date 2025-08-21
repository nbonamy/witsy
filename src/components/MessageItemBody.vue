<template>
  <div v-if="message.type == 'text'">
    <template v-if="reasoningBlocks.length">
      <div @click="onToggleReasoning" class="toggle-reasoning">
        <ChevronDownIcon v-if="showReasoning" />
        <ChevronRightIcon v-else />
        {{ isThinking ? t('message.reasoning.active') : showReasoning ? t('message.reasoning.hide') : t('message.reasoning.show') }}
        <span class="thinking-ellipsis" v-if="isThinking"></span>
      </div>
      <div class="think" v-if="showReasoning">
        <div v-for="block in reasoningBlocks">
          <MessageItemBodyBlock :block="block" @media-loaded="onMediaLoaded(message)" />
        </div>
      </div>
    </template>
    <div v-for="block in contentBlocks">
      <MessageItemBodyBlock :block="block" @media-loaded="onMediaLoaded(message)" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ChevronDownIcon, ChevronRightIcon } from 'lucide-vue-next'
import { computed, inject, onMounted, PropType, ref } from 'vue'
import Message from '../models/message'
import { t } from '../services/i18n'
import { closeOpenMarkdownTags, getCodeBlocks } from '../services/markdown'
import { store } from '../services/store'
import { ChatToolMode } from '../types/config'
import MessageItemBodyBlock, { Block } from './MessageItemBodyBlock.vue'

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const showReasoning = inject('showReasoning', ref(store.config.appearance.chat.showReasoning))
const userToggleReasoning = inject('onToggleReasoning', (value: boolean) => {
  store.config.appearance.chat.showReasoning = value
  store.saveSettings()
})

const props = defineProps({
  message: {
    type: Object as PropType<Message>,
    required: true,
  },
  showToolCalls: {
    type: String as PropType<ChatToolMode>,
    required: true,
  },
})

const isThinking = computed(() => {
  return props.message.transient && props.message.reasoning?.length && !props.message.content?.length
})

const reasoningBlocks = computed((): Block[] => {
  return computeBlocks(props.message.reasoning)
})

const contentBlocks = computed((): Block[] => {
  const blocks = computeBlocks(props.message.content)
  if (blocks.length === 0 && !props.message.transient) {
    return [{ type: 'empty' }]
  } else {
    return blocks
  }
})

const onToggleReasoning = () => {
  showReasoning.value = !showReasoning.value
  userToggleReasoning(showReasoning.value)
  emitEvent('toggle-reasoning', showReasoning.value)
}

onMounted(() => {
  onEvent('toggle-reasoning', (value: boolean) => {
    showReasoning.value = value
  })  
})

const emits = defineEmits(['media-loaded'])

const onMediaLoaded = (message: Message) => {
  emits('media-loaded', message)
}

const computeBlocks = (content: string|null): Block[] => {

  // if no content, return empty
  if (!content || content.trim().length === 0 || content.replaceAll('\n', '').trim().length === 0) {
    return []
  }

  // user message does not have this
  if (props.message.role !== 'assistant') {
    return [{ type: 'text', content }]
  }

  // if transient make sure we close markdown tags
  if (props.message.transient) {
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
  const regexMedia1 = /(?<!\[)!\[([^\]]*)\]\(([^\)]*)\)/g
  const regexMedia2 = /<(?:img|video)[^>]*?src="([^"]*)"[^>]*?>/g
  const regexArtifact1 = /<artifact title=\"([^\"]*)\">(.*?)<\/artifact>/gms
  const regexTool1 = /<tool (id|index)="([^\"]*)"><\/tool>/g

  while (lastIndex < content.length) {
    
    // Find the next match for each regex from current position
    const matches = []
    
    // Reset regex lastIndex to search from current position
    regexMedia1.lastIndex = lastIndex
    regexMedia2.lastIndex = lastIndex
    regexArtifact1.lastIndex = lastIndex
    regexTool1.lastIndex = lastIndex
    
    const media1Match = regexMedia1.exec(content)
    const media2Match = regexMedia2.exec(content)
    const artifact1Match = regexArtifact1.exec(content)
    const tool1Match = regexTool1.exec(content)
    
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
    
    // If no matches found, add remaining content as text and break
    if (matches.length === 0) {
      if (lastIndex < content.length) {
        blocks.push({ type: 'text', content: content.substring(lastIndex) })
      }
      break
    }
    
    // Find the match with the lowest index (earliest in the string)
    const nextMatch = matches.reduce((earliest, current) => 
      current.match.index < earliest.match.index ? current : earliest
    )
    
    const match = nextMatch.match
    const matchType = nextMatch.type
    
    // Add text content before this match
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: content.substring(lastIndex, match.index) })
    }
    
    // Process the match based on its type
    if (matchType === 'tool') {
      if (props.message.toolCalls.length) {
        const toolCall =
          match[1] === 'id' ? props.message.toolCalls.find(call => call.id === match[2]) :
          match[1] === 'index' ? props.message.toolCalls[parseInt(match[2])] : null
        if (toolCall && toolCall.done) {
          if (props.showToolCalls === 'always') {
            blocks.push({ type: 'tool', toolCall: toolCall })
          } else if (toolCall.name === 'search_internet') {
            blocks.push({ type: 'search', toolCall: toolCall })
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
      if (props.message.toolCalls) {
        for (const call of props.message.toolCalls) {
          const toolPath = call.result?.path || call.result?.url
          if (toolPath === match[match.length - 1] || toolPath === decodeURIComponent(match[match.length - 1])) {
            prompt = call.params.prompt
            break
          }
        }
      }

      // done
      const desc = match.length === 3 ? match[1] : 'Video'
      blocks.push({ type: 'media', url: imageUrl, desc, prompt })
    } else if (matchType === 'artifact') {
      blocks.push({ type: 'artifact', title: match[1], content: match[2] })
    }
    
    // Update lastIndex to continue after this match
    // This is the key fix - use the end position of the selected match
    lastIndex = match.index + match[0].length
  }

  // done
  //console.log('Computed blocks:', content, blocks)
  return blocks
}

const closeOpenArtifactTags = (content: string) => {

  const index1 = content.lastIndexOf('<artifact')
  const index2 = content.lastIndexOf('</artifact>')
  if (index1 > index2) {
    content += '</artifact>'
  }
  return content
}

</script>

<style>
.message .body .katex-html {
  display: none;
}
</style>
