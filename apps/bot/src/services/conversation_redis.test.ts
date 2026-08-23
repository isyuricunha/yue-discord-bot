import test from 'node:test'
import assert from 'node:assert/strict'

import { RedisConversationStore } from './conversation_redis'

test('redis_conversation_store: requires redis url', () => {
  assert.throws(() => new RedisConversationStore({ redis_url: '' }), /REDIS_URL/i)
})

test('redis_conversation_store: append uses one atomic Redis EVAL command', async () => {
  const store = new RedisConversationStore({
    redis_url: 'redis://localhost:6379',
    key_prefix: 'test:conversation',
    ttl_seconds: 120,
    max_messages: 4,
    max_message_chars: 5,
  })

  const commands: string[][] = []

  ;(store as any).run_redis_command = async (
    _label: string,
    command: (client: { sendCommand(args: string[]): Promise<number> }) => Promise<unknown>
  ) => command({
    sendCommand: async (args: string[]) => {
      commands.push(args)
      return 1
    },
  })

  await store.append('guild:channel:user', {
    role: 'user',
    content: 'abcdef',
  })

  assert.equal(commands.length, 1)

  const args = commands[0]
  assert.equal(args[0], 'EVAL')
  assert.match(args[1], /redis\.call\('GET', redis_key\)/)
  assert.match(args[1], /redis\.call\('SET', redis_key/)
  assert.equal(args[2], '1')
  assert.equal(args[3], 'test:conversation:guild:channel:user')
  assert.deepEqual(JSON.parse(args[4]), {
    role: 'user',
    content: 'abcde…',
  })
  assert.equal(args[5], '4')
  assert.ok(Number.isFinite(Number(args[6])))
  assert.equal(args[7], '120')
})
