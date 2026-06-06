type PendingMember = {
  guildId: string
  userId: string
}

type PendingLoader = () => Promise<PendingMember[]>

function pendingKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`
}

export class AutorolePendingIndex {
  private keys = new Set<string>()
  private readonly overrides = new Map<string, boolean>()
  private initialized = false
  private inFlight: Promise<void> | null = null

  constructor(private readonly loadPending: PendingLoader) {}

  async initialize(): Promise<void> {
    if (this.initialized) return
    if (this.inFlight) return this.inFlight

    const load = this.loadPending()
      .then((pendingMembers) => {
        const nextKeys = new Set(
          pendingMembers.map((pending) => pendingKey(pending.guildId, pending.userId))
        )

        for (const [key, isWaiting] of this.overrides.entries()) {
          if (isWaiting) nextKeys.add(key)
          else nextKeys.delete(key)
        }

        this.keys = nextKeys
        this.overrides.clear()
        this.initialized = true
      })
      .finally(() => {
        if (this.inFlight === load) {
          this.inFlight = null
        }
      })

    this.inFlight = load
    return load
  }

  async isWaiting(guildId: string, userId: string): Promise<boolean> {
    await this.initialize()
    return this.keys.has(pendingKey(guildId, userId))
  }

  mark(guildId: string, userId: string, isWaiting: boolean): void {
    const key = pendingKey(guildId, userId)

    if (isWaiting) this.keys.add(key)
    else this.keys.delete(key)

    if (!this.initialized) {
      this.overrides.set(key, isWaiting)
    }
  }
}
