<template>
  <div class="debug">
    
    <div class="panel">
      <div class="navigation">
        <BIconTrash @click="clearRequests"/>
      </div>
      <div class="list">
        <div v-if="requests.length === 0" class="empty">
          No network requests captured yet
        </div>
        <div v-else class="requests">
          <div v-for="(request, index) in requests" :key="index" class="item" :class="{ selected: selected === request }" @click="selectRequest(request)"> <span class="url">{{ request.url.split('/').slice(0, 3).join('/') }}</span>
            <span v-if="request.statusCode" class="status" :class="{ 'error': request.statusCode >= 400 }">
              {{ request.statusCode }}
            </span>
            <span v-else class="status pending" >•••</span>
          </div>
        </div>
      </div>
    </div>

    <div class="details">
      <div class="toolbar">
        <template v-if="selected">
          <div class="title">{{ selected.method }} {{ selected.url }}</div>
        </template>
      </div>
      <template v-if="selected">
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
                <JsonViewer :value="headers" :expand-depth="1" copyable sort theme="jv-dark" :expanded="true" />
              </div>
            </div>
            <div class="section" v-if="data">
              <h3>Body</h3>
              <div class="json" v-if="jsonData(data)">
                <JsonViewer :value="jsonData(data)" :expand-depth="1" copyable sort theme="jv-dark" :expanded="true" />
              </div>
              <pre v-else>{{ data }}</pre>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">

import { NetworkRequest } from '../types'
import { ref, Ref, computed, onMounted } from 'vue'

import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/index.css'

const requests: Ref<NetworkRequest[]> = ref([])
const selected: Ref<NetworkRequest | null> = ref(null)
const activeTab: Ref<'request'|'response'> = ref('request')

const headers = computed(() => {
  if (activeTab.value === 'request') {
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

onMounted(() => {

  requests.value = window.api.debug.getNetworkHistory()

  window.api.on('network', (request: NetworkRequest) => {
    const existingIndex = requests.value.findIndex((r) => r.id === request.id)
    if (existingIndex >= 0) {
      requests.value[existingIndex] = request
    } else {
      requests.value.push(request)
    }
  })

})

const jsonData = (data: string) => {
  try {
    return JSON.parse(data)
  } catch (e) {
    return null
  }
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

:root {
  --debug-panel-width: 200px;
}

.debug {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  color: var(--text-color);
}

.panel {
  flex: 0 0 var(--debug-panel-width);
  background-color: var(--sidebar-bg-color);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.navigation {
  padding: 16px;
  text-align: right;
  -webkit-app-region: drag;

  > * {
    fill: var(--sidebar-icon-color);
    -webkit-app-region: no-drag;
    cursor: pointer;
  }

}

.list {
  background-color: var(--sidebar-bg-color);
  scrollbar-color: var(--sidebar-scroll-thumb-color) var(--sidebar-bg-color);
  padding: 0px 0px;
  overflow-y: auto;
}

.empty {
  padding: 32px;
  text-align: center;
}

.item {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--dialog-border-color);
  cursor: pointer;
  font-size: 10pt;
}

.item:first-child {
  border-top: 1px solid var(--dialog-border-color);
}

.item.selected {
  background-color: var(--sidebar-selected-color);
}

.url {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--control-bg-color);
  width: calc(100% - var(--create-panel-width));

  --toolbar-height: 48px;
  --toolbar-padding: 16px;
  --preview-padding: 32px;
}

.details .toolbar {
  padding: 16px;
  flex-basis: calc(var(--toolbar-height) - var(--toolbar-padding) * 2); 
  background-color: var(--chatarea-toolbar-bg-color);
  -webkit-app-region: drag;
  display: flex;
  gap: 16px;
}

.details .toolbar .title {
  flex: 1;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 8px;
  color: var(--chatarea-toolbar-text-color);
}

.tabs button {
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  cursor: pointer;
  color: var(--text-color, #666);
  font-size: 10pt;

  &:hover {
    background: none;
  }

  &.active {
    border-bottom-color: var(--primary-color, #2196F3);
    color: var(--primary-color, #2196F3);
  }

}

.windows {
  .toolbar {
    padding-right: 148px;
    .menu {
      margin-top: 1px;
    }
  }
}

.linux {
  .toolbar {
    padding-right: 92px;
    .menu {
      margin-top: 0px;
    }
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
  white-space: pre-wrap;
  word-break: break-all;
  background-color: rgb(13,13,13);
  color: #fff;
  padding: 12px;
  border-radius: 8px;
  font-size: 9.5pt;
}

.json {
  background-color: rgb(13,13,13);
  border-radius: 8px;

  &:deep() {
    
    span, a {
      font-family: SF Mono,Monaco,Andale Mono,Ubuntu Mono,monospace !important;
      font-size: 9.5pt;
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

</style>
