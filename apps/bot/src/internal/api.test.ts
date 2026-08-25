import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import type { Client } from 'discord.js'

import { start_internal_api } from './api'

async function with_server(run: (base_url: string, secret: string) => Promise<void>) {
  const secret = 's'.repeat(32)
  const client = {
    guilds: { cache: new Map() },
    commands: new Map(),
    contextMenuCommands: new Map(),
  } as unknown as Client
  const server = start_internal_api(client, {
    host: '127.0.0.1',
    port: 0,
    secret,
    maxBodyBytes: 64,
  })
  if (!server.listening) await once(server, 'listening')
  const address = server.address() as AddressInfo
  try {
    await run(`http://127.0.0.1:${address.port}`, secret)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('internal API rejects oversized authorized JSON with 413', async () => {
  await with_server(async (base, secret) => {
    const response = await fetch(`${base}/internal/profile`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user', bio: 'x'.repeat(200) }),
    })
    assert.equal(response.status, 413)
    assert.deepEqual(await response.json(), { error: 'Request body too large' })
  })
})

test('internal API keeps malformed in-limit JSON as a 400 route error', async () => {
  await with_server(async (base, secret) => {
    const response = await fetch(`${base}/internal/profile`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: '{',
    })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Invalid body' })
  })
})

test('internal API authenticates before consuming an oversized body', async () => {
  await with_server(async (base) => {
    const response = await fetch(`${base}/internal/profile`, {
      method: 'POST',
      headers: { authorization: 'Bearer wrong', 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user', bio: 'x'.repeat(200) }),
    })
    assert.equal(response.status, 401)
  })
})
