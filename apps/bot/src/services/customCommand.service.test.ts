import test from 'node:test'
import assert from 'node:assert/strict'
import type { Message } from 'discord.js'

import { CustomCommandService, find_matching_custom_command } from './customCommand.service'

function make_message(input: {
  guildId: string
  content: string
  sent: unknown[]
}): Message {
  return {
    guild: { id: input.guildId },
    author: { bot: false },
    content: input.content,
    channel: {
      send: async (payload: unknown) => {
        input.sent.push(payload)
      },
    },
  } as unknown as Message
}

test('find_matching_custom_command matches exact triggers and command arguments', () => {
  const commands = [
    { name: '!regras', response: 'rules' },
    { name: 'ping', response: 'pong' },
  ]

  assert.deepEqual(find_matching_custom_command(commands, '!regras'), commands[0])
  assert.deepEqual(find_matching_custom_command(commands, '!regras detalhes'), commands[0])
  assert.deepEqual(find_matching_custom_command(commands, 'PING'), commands[1])
})

test('find_matching_custom_command does not match partial trigger prefixes', () => {
  const commands = [{ name: '!regras', response: 'rules' }]

  assert.equal(find_matching_custom_command(commands, '!regra'), null)
  assert.equal(find_matching_custom_command(commands, '!regrasse'), null)
})

test('CustomCommandService caches command lookups per guild within ttl', async () => {
  const sent: unknown[] = []
  const calls: string[] = []
  const db = {
    customCommand: {
      findMany: async (args: { where: { guildId: string } }) => {
        calls.push(args.where.guildId)
        return [{ name: '!regras', response: 'Leia as regras.' }]
      },
    },
  }

  const service = new CustomCommandService(db, { cache_ttl_ms: 60_000 })

  const first = await service.handle_message(make_message({
    guildId: 'guild-1',
    content: '!regras',
    sent,
  }))
  const second = await service.handle_message(make_message({
    guildId: 'guild-1',
    content: '!regras detalhes',
    sent,
  }))

  assert.equal(first, true)
  assert.equal(second, true)
  assert.deepEqual(calls, ['guild-1'])
  assert.equal(sent.length, 2)
})

test('CustomCommandService can invalidate one guild cache entry', async () => {
  const calls: string[] = []
  const db = {
    customCommand: {
      findMany: async (args: { where: { guildId: string } }) => {
        calls.push(args.where.guildId)
        return [{ name: '!regras', response: 'Leia as regras.' }]
      },
    },
  }

  const service = new CustomCommandService(db, { cache_ttl_ms: 60_000 })

  await service.handle_message(make_message({
    guildId: 'guild-1',
    content: '!regras',
    sent: [],
  }))
  service.invalidate_guild('guild-1')
  await service.handle_message(make_message({
    guildId: 'guild-1',
    content: '!regras',
    sent: [],
  }))

  assert.deepEqual(calls, ['guild-1', 'guild-1'])
})
