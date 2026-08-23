import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import { install_process_handlers } from './process_handlers'
import type { BotRuntime } from './create_bot_runtime'

function next_turn() {
  return new Promise<void>((resolve) => setImmediate(resolve))
}

function fake_runtime(on_shutdown: (reason: string) => void): BotRuntime {
  return {
    client: {} as BotRuntime['client'],
    start: async () => undefined,
    shutdown: async (reason) => {
      on_shutdown(reason)
    },
    service_count: () => 0,
  }
}

test('unhandled rejection triggers one graceful fatal shutdown', async () => {
  const target = new EventEmitter() as EventEmitter & { exit: (code?: number) => never }
  const exits: number[] = []
  const shutdowns: string[] = []

  target.exit = ((code?: number) => {
    exits.push(code ?? 0)
    return undefined as never
  })

  install_process_handlers(
    fake_runtime((reason) => shutdowns.push(reason)),
    target as unknown as NodeJS.Process
  )

  target.emit('unhandledRejection', new Error('boom'), Promise.resolve())
  target.emit('SIGTERM')
  await next_turn()

  assert.deepEqual(shutdowns, ['unhandledRejection'])
  assert.deepEqual(exits, [1])
})

test('SIGTERM uses the same graceful shutdown path with exit code zero', async () => {
  const target = new EventEmitter() as EventEmitter & { exit: (code?: number) => never }
  const exits: number[] = []
  const shutdowns: string[] = []

  target.exit = ((code?: number) => {
    exits.push(code ?? 0)
    return undefined as never
  })

  install_process_handlers(
    fake_runtime((reason) => shutdowns.push(reason)),
    target as unknown as NodeJS.Process
  )

  target.emit('SIGTERM')
  await next_turn()

  assert.deepEqual(shutdowns, ['SIGTERM'])
  assert.deepEqual(exits, [0])
})
