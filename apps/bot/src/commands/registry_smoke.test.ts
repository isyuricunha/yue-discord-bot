import test from 'node:test'
import assert from 'node:assert/strict'

import { Client, Collection } from 'discord.js'

// Smoke do registro inteiro de comandos: roda o loadCommands real (todos os
// builders, todas as subpastas) com um client falso, no mesmo padrão do
// export-commands.ts: nada do Discord é tocado. Pega import quebrado, builder
// inválido e execute faltando em qualquer comando novo antes do CI.

function fake_client(): Client {
  const client = new Client({ intents: [] })
  client.commands = new Collection()
  client.contextMenuCommands = new Collection()
  return client
}

test('loadCommands carrega todo slash command com builder válido e execute', async () => {
  const { loadCommands } = await import('./index')

  const client = fake_client()
  await loadCommands(client)

  assert.ok(client.commands.size > 0, 'nenhum comando carregado')

  for (const [name, command] of client.commands) {
    assert.equal(name, command.data.name, 'chave do registro difere do data.name')
    assert.ok(name.length > 0)
    assert.equal(typeof command.execute, 'function', `${name} sem execute`)

    // Builder inválido (campos obrigatórios faltando, descrição vazia, etc.)
    // lança aqui, no mesmo caminho que o deploy real percorre.
    const json = command.data.toJSON()
    assert.equal(json.name, name)
  }
})

test('loadContextMenuCommands carrega context menus válidos', async () => {
  const { loadContextMenuCommands } = await import('./index')

  const client = fake_client()
  await loadContextMenuCommands(client)

  assert.ok(client.contextMenuCommands.size > 0, 'nenhum context menu carregado')

  for (const [name, command] of client.contextMenuCommands) {
    assert.equal(name, command.data.name, 'chave do registro difere do data.name')
    assert.equal(typeof command.execute, 'function', `${name} sem execute`)
    assert.equal(command.data.toJSON().name, name)
  }
})
