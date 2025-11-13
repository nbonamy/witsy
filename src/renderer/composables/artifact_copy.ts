import { ref } from 'vue'

export function useArtifactCopy(contentGetter: () => string) {
  const copying = ref(false)

  const onCopy = () => {
    copying.value = true
    navigator.clipboard.writeText(contentGetter())
    setTimeout(() => {
      copying.value = false
    }, 1000)
  }

  return {
    copying,
    onCopy,
  }
}
