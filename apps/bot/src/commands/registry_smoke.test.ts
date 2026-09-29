import test from 'node:test'
import assert from 'node:assert/strict'

import { Client, Collection } from 'discord.js'

// Whole command registry smoke: runs the real loadCommands (every builder,
// every subfolder) with a fake client, same pattern as export-commands.ts:
// nothing from Discord is touched. Catches a broken import, an invalid
// builder or a missing execute in any new command before CI.

function fake_client(): Client {
  const client = new Client({ intents: [] })
  client.commands = new Collection()
  client.contextMenuCommands = new Collection()
  return client
}

test('loadCommands loads every slash command with a valid builder and execute', async () => {
  const { loadCommands } = await import('./index')

  const client = fake_client()
  await loadCommands(client)

  assert.ok(client.commands.size > 0, 'no command loaded')

  for (const [name, command] of client.commands) {
    assert.equal(name, command.data.name, 'registry key differs from data.name')
    assert.ok(name.length > 0)
    assert.equal(typeof command.execute, 'function', `${name} missing execute`)

    // Invalid builder (missing required fields, empty description, etc.)
    // throws here, on the same path the real deploy goes through.
    const json = command.data.toJSON()
    assert.equal(json.name, name)
  }
})

test('loadContextMenuCommands loads valid context menus', async () => {
  const { loadContextMenuCommands } = await import('./index')

  const client = fake_client()
  await loadContextMenuCommands(client)

  assert.ok(client.contextMenuCommands.size > 0, 'no context menu loaded')

  for (const [name, command] of client.contextMenuCommands) {
    assert.equal(name, command.data.name, 'registry key differs from data.name')
    assert.equal(typeof command.execute, 'function', `${name} missing execute`)
    assert.equal(command.data.toJSON().name, name)
  }
})
