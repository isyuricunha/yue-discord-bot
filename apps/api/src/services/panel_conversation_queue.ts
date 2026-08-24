export class PanelConversationQueue {
  private readonly tails = new Map<string, Promise<void>>()

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve()

    let release!: () => void
    const tail = new Promise<void>((resolve) => {
      release = resolve
    })

    this.tails.set(key, tail)
    await previous.catch(() => undefined)

    try {
      return await task()
    } finally {
      release()
      if (this.tails.get(key) === tail) {
        this.tails.delete(key)
      }
    }
  }

  pending_keys(): number {
    return this.tails.size
  }
}

export const panel_conversation_queue = new PanelConversationQueue()
