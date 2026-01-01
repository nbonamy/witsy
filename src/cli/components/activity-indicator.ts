// ActivityIndicator component - simple animated spinner with text

import { Component } from './component'
import { secondaryText } from '../display'

// Pulsating animation frames
const ANIMATION_FRAMES = [
  '⋅',
  '∘',
  '○',
  '◯',
  '⊙',
  '◉',
  '⊙',
  '◯',
  '○',
  '∘',
]

export class ActivityIndicator extends Component {
  private text: string
  private animationFrame: number = 0

  constructor(text: string = '') {
    super()
    this.text = text
  }

  setText(text: string): void {
    if (this.text !== text) {
      this.text = text
      this.markDirty()
    }
  }

  getText(): string {
    return this.text
  }

  // Advance animation frame (called by animation interval)
  advanceAnimation(): void {
    this.animationFrame = (this.animationFrame + 1) % ANIMATION_FRAMES.length
    this.markDirty()
  }

  // Always 1 line
  calculateHeight(): number {
    return 1
  }

  render(): string[] {
    const frame = secondaryText(ANIMATION_FRAMES[this.animationFrame])
    return [this.text ? `${frame} ${this.text}` : frame]
  }
}
