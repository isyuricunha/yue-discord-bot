export type lifecycle_service = {
  start: () => void | Promise<void>
  stop: () => void | Promise<void>
}

type registered_service = {
  name: string
  stop: () => void | Promise<void>
}

export type lifecycle_stop_error = {
  name: string
  error: unknown
}

export class RuntimeLifecycle {
  private readonly services: registered_service[] = []
  private stop_promise: Promise<lifecycle_stop_error[]> | null = null
  private stopping = false

  async start_service(name: string, service: lifecycle_service): Promise<void> {
    if (this.stopping) {
      throw new Error(`Cannot start ${name}: runtime lifecycle is stopping`)
    }

    try {
      await service.start()

      if (this.stopping) {
        await service.stop()
        return
      }

      this.services.push({ name, stop: () => service.stop() })
    } catch (error) {
      try {
        await service.stop()
      } catch {
        // Preserve the original startup failure. shutdown() handles services
        // that completed startup before this one.
      }
      throw error
    }
  }

  register_started(name: string, stop: () => void | Promise<void>): void {
    if (this.stopping) {
      void Promise.resolve()
        .then(() => stop())
        .catch(() => undefined)
      return
    }

    this.services.push({ name, stop })
  }

  stop_all(): Promise<lifecycle_stop_error[]> {
    if (this.stop_promise) return this.stop_promise

    this.stopping = true
    this.stop_promise = this.stop_registered_services()
    return this.stop_promise
  }

  count(): number {
    return this.services.length
  }

  private async stop_registered_services(): Promise<lifecycle_stop_error[]> {
    const errors: lifecycle_stop_error[] = []

    for (const service of [...this.services].reverse()) {
      try {
        await service.stop()
      } catch (error) {
        errors.push({ name: service.name, error })
      }
    }

    this.services.length = 0
    return errors
  }
}
