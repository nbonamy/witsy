import { onMounted, onBeforeUnmount, ref } from 'vue'
import { DocRepoAddDocResponse, DocumentQueueItem } from 'types/rag'
import Dialog from './dialog'

export function useDocRepoEvents() {
  const loading = ref(false)
  const processingItems = ref<string[]>([])

  const onProcessItemStart = (payload: DocumentQueueItem) => {
    processingItems.value.push(payload.parentDocId ?? payload.uuid)
  }

  const onProcessItemDone = (payload: DocumentQueueItem) => {
    processingItems.value = processingItems.value.filter(id => id !== (payload.parentDocId ?? payload.uuid))
  }

  const onAddDocDone = (payload: DocRepoAddDocResponse) => {
    const queueLength = payload.queueLength
    loading.value = queueLength > 0
  }

  const onAddDocError = (payload: DocRepoAddDocResponse) => {
    const queueLength = payload.queueLength
    loading.value = queueLength > 0
    Dialog.alert(payload.error)
  }

  const onDelDocDone = () => {
    loading.value = false
  }

  onMounted(() => {
    window.api.on('docrepo-process-item-start', onProcessItemStart)
    window.api.on('docrepo-process-item-done', onProcessItemDone)
    window.api.on('docrepo-add-document-done', onAddDocDone)
    window.api.on('docrepo-add-document-error', onAddDocError)
    window.api.on('docrepo-del-document-done', onDelDocDone)

    window.api.docrepo.getCurrentQueueItem().then((item) => {
      if (item) {
        onProcessItemStart(item)
      }
    })
  })

  onBeforeUnmount(() => {
    window.api.off('docrepo-process-item-start', onProcessItemStart)
    window.api.off('docrepo-process-item-done', onProcessItemDone)
    window.api.off('docrepo-add-document-done', onAddDocDone)
    window.api.off('docrepo-add-document-error', onAddDocError)
    window.api.off('docrepo-del-document-done', onDelDocDone)
  })

  return {
    loading,
    processingItems
  }
}
