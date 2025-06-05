
<template>
  <div class="debug panel-content window">
    <div class="panel">
      <header>
        <div class="title">{{ t('debugConsole.title') }}</div>
        <BIconTrash class="icon" @click="clearRequests"/>
      </header>
      <main class="list">
        <div v-if="requests.length === 0" class="empty">
          No network requests captured yet
        </div>
        <div v-else class="requests">
          <div v-for="(request, index) in requests" :key="index" class="item" :class="{ selected: selected === request }" @click="selectRequest(request)"> <span class="url">{{ request.url.split('/').slice(0, 3).join('/') }}</span>
            <span v-if="request.statusCode" class="status" :class="{ 'error': request.statusCode >= 400 }">
              {{ request.statusCode }}
            </span>
            <span v-else class="status pending" >
              <Loader />
              <Loader />
              <Loader />
            </span>
          </div>
        </div>
      </main>
    </div>

    <div class="details content">
      <header>
        <template v-if="selected">
          <div class="title">{{ selected.method }} {{ selected.url }}</div>
        </template>
      </header>
      <main v-if="selected && selected.type === 'http'">
        <div class="tabs">
          <button :class="{ active: activeTab === 'request' }" @click="activeTab = 'request'">Request</button>
          <button :class="{ active: activeTab === 'response' }" @click="activeTab = 'response'">Response</button>
        </div>
        <div class="tab-content">
          <div v-if="activeTab === 'response' && !selected.statusCode">
            <pre>Waiting for response...</pre>
          </div>
          <template v-else>
            <div class="section" v-if="headers">
              <h3>Headers</h3>
              <div class="json expanded">
                <JsonViewer :value="headers" :expand-depth="1" :copyable="copyable" sort theme="jv-dark" :expanded="true" />
              </div>
            </div>
            <div class="section" v-if="data">
              <h3>Body</h3>
              <div class="json" v-if="jsonData(data)">
                <JsonViewer :value="jsonData(data)" :expand-depth="1" :copyable="copyable" sort theme="jv-dark" :expanded="true" />
              </div>
              <pre v-else>{{ data }}<div class="copy" :class="{ copying: copying }" @click="copyData(data)">{{ t(copying ? 'common.copied' : 'common.copy').toLowerCase() }}</div></pre>
            </div>
          </template>
        </div>
      </main>
      <main v-if="selected && selected.type === 'websocket'">
        <div class="tab-content">
          <div class="section" v-if="headers">
            <h3>Headers</h3>
            <div class="json expanded">
              <JsonViewer :value="headers" :expand-depth="1" :copyable="copyable" sort theme="jv-dark" :expanded="true" />
            </div>
          </div>
          <div class="section" v-if="selected.frames.length > 0">
            <h3>Frames</h3>
            <div class="json" v-for="frame in selected.frames">
              <!-- {{  frame.payloadData }} -->
              <JsonViewer :value="jsonFrame(frame)" :expand-depth="2" :copyable="copyable" theme="jv-dark" :expanded="true" />
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">

import { NetworkRequest, WebSocketFrame } from '../types'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Loader from '../components/Loader.vue'
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/vue3-json-viewer.css'

// load store
store.loadSettings()

const requests = ref<NetworkRequest[]>([])
const selected = ref<NetworkRequest | null>(null)
const activeTab = ref<'request'|'response'>('request')
const copying = ref(false)

const headers = computed(() => {
  if (activeTab.value === 'request' && selected.value?.type === 'http') {
    return selected.value?.headers || {}
  } else {
    return selected.value?.responseHeaders || {}
  }
})

const data = computed(() => {
  if (activeTab.value === 'request') {
    return selected.value?.postData
  } else {
    return selected.value?.responseBody
  }
})

const copyable = computed(() => {
  return {
    copyText: t('common.copy').toLowerCase(),
    copiedText: t('common.copied').toLowerCase(),
    timeout: 1000
  }
})

onMounted(() => {
  requests.value = window.api.debug.getNetworkHistory()
  window.api.on('network', onNetworkRequest)
})

onUnmounted(() => {
  window.api.off('network', onNetworkRequest)
})

const onNetworkRequest = (request: NetworkRequest) => {
  //console.log('Received Network request:', request)
  const existingIndex = requests.value.findIndex((r) => r.id === request.id)
  if (existingIndex >= 0) {
    requests.value[existingIndex] = request
  } else {
    requests.value.push(request)
  }
}

const jsonData = (data: string) => {
  try {
    return JSON.parse(data)
  } catch (e) {
    return null
  }
}

const jsonFrame = (frame: WebSocketFrame) => {
  try {
    const jsonData = JSON.parse(frame.payloadData)
    return {
      type: frame.type,
      data: jsonData,
    }
  } catch (e) {
    return {
      type: frame.type,
      data: frame.payloadData,
    }
  }
}

const copyData = (data: string) => {
  copying.value = true
  window.api.clipboard.writeText(data)
  setTimeout(() => {
    copying.value = false
  }, 1000)
}

const clearRequests = () => {
  requests.value = []
  selected.value = null
  window.api.debug.clearNetworkHistory()
}

const selectRequest = (request: NetworkRequest) => {
  selected.value = request
}

</script>

<style scoped>
@import '../../css/panel-content.css';
</style>

<style scoped>

.panel-content {

  .panel {
    flex: 0 0 250px;
    main {
      padding-top: 0px;
    }
  }

  .loader {
    position: relative;
    top: -3px;
    width: 0.2rem;
    height: 0.2rem;
    margin: 0 0.1rem;
    background-color: #ff9800;
  }

  .list {
    padding: 0px 0px;
    overflow: hidden;
    max-width: 280px;
  }

  .requests {
    overflow-y: auto;
    scrollbar-color: var(--sidebar-scroll-thumb-color) var(--control-bg-color);
    flex: 1;
  }

  .empty {
    padding: 32px;
    text-align: center;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--dialog-border-color);
    cursor: pointer;
    font-size: 10pt;
  }

  .item.selected {
    background-color: var(--sidebar-selected-color);
  }

  .url {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-color);
  }

  .status {
    font-weight: bold;
  }

  .status {
    color: #4caf50;
  }

  .status.pending {
    color: #ff9800;
  }

  .status.error {
    color: #f44336;
  }

  .details {
    width: calc(100% - var(--create-panel-width));
    --preview-padding: 32px;
  }

  .tabs {
    padding-bottom: 8px;
  }

  .tabs button {
    padding: 8px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    cursor: pointer;
    color: var(--text-color, #666);
    font-size: 10.5pt;

    &:hover {
      background: none;
    }

    &.active {
      border-bottom-color: var(--primary-color, #2196F3);
      color: var(--primary-color, #2196F3);
    }

  }

  .tab-content {
    padding: 24px;
    padding-top: 0px;
    overflow-y: auto;
    scrollbar-color: var(--sidebar-scroll-thumb-color) var(--control-bg-color);
    flex: 1;
  }

  .section {
    margin-bottom: 20px;
  }

  .section h3 {
    margin-bottom: 8px;
    font-size: 1rem;
    color: var(--text-color);
  }

  pre {
    position: relative;
    white-space: pre-wrap;
    word-break: break-all;
    background-color: rgb(13,13,13);
    color: #fff;
    padding: 12px;
    padding-top: 36px;
    border-radius: 8px;
    font-size: 10.5pt;

    .copy {
      cursor: pointer;
      position: absolute;
      right: 24px;
      top: 8px;
      font-family: SF Mono,Monaco,Andale Mono,Ubuntu Mono,monospace !important;
      font-size: 10.5pt;
      &.copying {
        opacity: 0.4;
      }
    }
  }

  .json {
    margin-bottom: 1rem;
    background-color: rgb(13,13,13);
    border-radius: 8px;
    color: white;

    &:deep() {
      
      span, a {
        font-family: SF Mono,Monaco,Andale Mono,Ubuntu Mono,monospace !important;
        font-size: 10.5pt;
      }

      .jv-code {
        padding: 12px;
        white-space: pre-wrap;
      }

      .jv-ellipsis {
        cursor: pointer;
      }

      .jv-toggle {
        background: none;
        &::before {
          color: var(--link-color);
          content : '⏵';
        }
        &.open {
          position: relative;
          top: 4px;
          left: 2px;
        }
      }
    
    }

    &.expanded :deep() {
      .jv-toggle {
        display: none
      }
    }
  }

}

</style>
