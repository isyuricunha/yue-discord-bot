import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '@yuebot/database'
import type { ChatInputCommandInteraction } from 'discord.js'

import { estatisticasCommand } from './estatisticas'

function create_interaction(guildId: string | null) {
  const replies: unknown[] = []

  const interaction = {
    guildId,
    user: { id: 'user-1', username: 'user', displayAvatarURL: () => '' },
    options: { getSubcommand: () => 'xp' },
    reply: async (payload: { embeds: Array<{ toJSON: () => unknown }> }) => {
      replies.push(payload.embeds[0]?.toJSON())
    },
  } as unknown as ChatInputCommandInteraction

  return { interaction, replies }
}

// Prisma's generated client model methods are not plain own-properties (they
// live behind an internal proxy), so node:test's mock.method cannot bind to
// them directly. Direct stubbing, matching the pattern already used by the
// audit's own probe scripts, works because these are plain assignable object
// properties at runtime.
function stub<T extends object, K extends keyof T>(model: T, method: K, value: unknown): () => void {
  const original = model[method]
  ;(model as any)[method] = typeof value === 'function' ? value : async () => value
  return () => {
    ;(model as any)[method] = original
  }
}

test('estatisticas xp only shows XP for the guild the command was run in (audit finding BOT-005)', async (t) => {
  const restores: Array<() => void> = []
  t.after(() => restores.forEach((restore) => restore()))

  let captured_guild_id: string | undefined
  restores.push(stub(prisma.globalXpMember, 'findUnique', async () => ({ level: 2, xp: 100 })))
  restores.push(
    stub(prisma.guildXpMember, 'findFirst', async (args: any) => {
      // Simulates the real query filtering by guildId: only the row whose
      // guildId matches the where-clause is returned, unlike the pre-fix
      // findFirst({ where: { userId } }) which ignored guildId entirely and
      // could return XP from an arbitrary guild.
      captured_guild_id = args.where.guildId
      if (args.where.guildId !== 'guild-current') return null
      return { level: 3, xp: 50, guild: { name: 'Current Guild' } }
    })
  )
  restores.push(stub(prisma.wallet, 'findUnique', async () => ({ balance: 10n, bankBalance: 20n })))
  restores.push(stub(prisma.triviaStat, 'findUnique', async () => ({ correctAnswers: 1, score: 2 })))
  restores.push(stub(prisma.waifuUserState, 'count', async () => 0))
  restores.push(stub(prisma.pet, 'count', async () => 0))
  restores.push(stub(prisma.userBadge, 'count', async () => 0))
  restores.push(stub(prisma.userProfile, 'findUnique', async () => null))
  restores.push(stub(prisma.waifuCharacter, 'count', async () => 1))
  restores.push(stub(prisma.badge, 'count', async () => 1))

  const { interaction, replies } = create_interaction('guild-current')
  await estatisticasCommand.execute(interaction)

  const embed = replies[0] as { fields: Array<{ name: string; value: string }> }
  const guild_field = embed.fields.find((field) => field.name.includes('Servidor'))

  assert.ok(guild_field)
  assert.match(guild_field.value, /Current Guild/)
  assert.equal(captured_guild_id, 'guild-current')
})
