import { onMounted, onBeforeUnmount, ref } from 'vue'
import { DocRepoAddDocResponse, DocumentQueueItem } from 'types/rag'
import useIpcListener from './ipc_listener'
import Dialog from '@renderer/utils/dialog'

export function useDocRepoEvents(type: string) {

  const { onIpcEvent } = useIpcListener()

  const loading = ref(false)
  const processingItems = ref<string[]>([])
  const processingBases = ref<string[]>([])

  const onProcessItemStart = (payload: DocumentQueueItem) => {
    processingItems.value.push(payload.parentDocId ?? payload.uuid)
    if (!processingBases.value.includes(payload.baseId)) {
      processingBases.value.push(payload.baseId)
    }
  }

  const onProcessItemDone = (payload: DocumentQueueItem) => {
    processingItems.value = processingItems.value.filter(id => id !== (payload.parentDocId ?? payload.uuid))
    processingBases.value = processingBases.value.filter(id => id !== payload.baseId)
  }

  const onAddDocDone = (payload: DocRepoAddDocResponse) => {
    const queueLength = payload.queueLength
    loading.value = queueLength > 0
  }

  const onAddDocError = (payload: DocRepoAddDocResponse) => {
    const queueLength = payload.queueLength
    loading.value = queueLength > 0
    if (payload.queueItem?.type === type && payload.error?.length) {
      Dialog.alert(payload.error)
    }
  }

  const onDelDocDone = () => {
    loading.value = false
  }

  onMounted(() => {
    onIpcEvent('docrepo-process-item-start', onProcessItemStart)
    onIpcEvent('docrepo-process-item-done', onProcessItemDone)
    onIpcEvent('docrepo-add-document-done', onAddDocDone)
    onIpcEvent('docrepo-add-document-error', onAddDocError)
    onIpcEvent('docrepo-del-document-done', onDelDocDone)

    window.api.docrepo.getCurrentQueueItem().then((item) => {
      if (item) {
        onProcessItemStart(item)
      }
    })
  })

  onBeforeUnmount(() => {
    // IPC listeners cleaned up by composable
  })

  return {
    loading,
    processingItems,
    processingBases
  }
}
