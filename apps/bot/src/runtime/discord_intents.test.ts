import test from 'node:test'
import assert from 'node:assert/strict'
import { GatewayIntentBits } from 'discord.js'

import { build_discord_intents } from './discord_intents'

const non_privileged_intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildModeration,
]

test('includes privileged intents when the kill switch is disabled', () => {
  const intents = build_discord_intents(false)

  assert.deepEqual(intents, [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
  ])
})

test('omits only privileged intents when the kill switch is enabled', () => {
  const intents = build_discord_intents(true)

  assert.deepEqual(intents, non_privileged_intents)
  assert.equal(intents.includes(GatewayIntentBits.MessageContent), false)
  assert.equal(intents.includes(GatewayIntentBits.GuildMembers), false)
})
