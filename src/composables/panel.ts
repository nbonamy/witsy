
export const togglePanel = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  const panel = target.closest('.panel')
  if (panel) {
    panel.classList.toggle('collapsed')
  }
  event.stopPropagation()
}  
