
export const togglePanel = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  target.classList.add('toggle-panel')
  const panel = target.closest('.panel')
  if (panel) {
    panel.classList.toggle('collapsed')
  }
  event.stopPropagation()
}  
