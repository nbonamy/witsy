
// Mutex for synchronizing exclusive access to a resource
export class Mutex {
  private locked = false
  private queue: (() => void)[] = []

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true
        resolve(() => this.release())
      } else {
        this.queue.push(() => resolve(() => this.release()))
      }
    })
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      next()
    } else {
      this.locked = false
    }
  }
}

// Semaphore for limiting concurrent access to a resource
export class Semaphore {
  private available: number
  private queue: (() => void)[] = []

  constructor(count: number) {
    this.available = count
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.available > 0) {
        this.available--
        resolve(() => this.release())
      } else {
        this.queue.push(() => resolve(() => this.release()))
      }
    })
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      next()
    } else {
      this.available++
    }
  }
}
