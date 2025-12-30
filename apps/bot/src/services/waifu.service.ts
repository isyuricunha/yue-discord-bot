import { prisma, Prisma } from '@yuebot/database'

import { aniListService } from './anilist.service'

export type waifu_source = 'ANILIST'

export type waifu_roll_kind = 'waifu' | 'husbando' | 'casar'

type desired_gender = 'female' | 'male' | 'any'

type tx_client = Prisma.TransactionClient

export type roll_result = {
  rollId: string
  character: {
    id: string
    source: waifu_source
    sourceId: number
    name: string
    nameNative: string | null
    imageUrl: string
    gender: string | null
  }
  claimedByUserId: string | null
  expiresAt: Date
}

export type claim_result =
  | {
      success: true
      characterName: string
      claimerUserId: string
      nextClaimAt: Date
    }
  | {
      success: false
      error:
        | 'not_found'
        | 'expired'
        | 'already_claimed'
        | 'cooldown'
        | 'snipe_protected'
        | 'not_in_guild'
      message: string
      claimedByUserId?: string
      nextClaimAt?: Date
    }

export type reroll_result =
  | {
      success: true
      kind: waifu_roll_kind
      oldRollId: string
      oldMessageId: string | null
      newRoll: roll_result
      nextRerollAt: Date
    }
  | {
      success: false
      error: 'not_found' | 'expired' | 'already_claimed' | 'cooldown'
      message: string
      nextRerollAt?: Date
    }

export type wishlist_add_result =
  | { success: true; characterId: string; characterName: string }
  | { success: false; error: 'invalid_query' | 'not_found' | 'ambiguous' | 'already_exists'; message: string }

export type wishlist_remove_result =
  | { success: true; characterId: string; characterName: string }
  | { success: false; error: 'invalid_query' | 'not_found' | 'ambiguous'; message: string }

const CLAIM_COOLDOWN_MS = 3 * 60 * 60 * 1000
const ROLL_EXPIRES_MS = 45 * 1000
const SNIPE_PROTECT_MS = 8 * 1000
const REROLL_COOLDOWN_MS = 30 * 60 * 1000

async function with_serializable_retry<T>(fn: (tx: tx_client) => Promise<T>, max_attempts = 5): Promise<T> {
  let attempt = 0
  while (true) {
    attempt += 1

    try {
      return await prisma.$transaction(async (tx) => await fn(tx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      const err = error as { code?: unknown }
      const code = typeof err.code === 'string' ? err.code : ''

      // Postgres serialization failure
      if (code === 'P2034' || code === '40001') {
        if (attempt >= max_attempts) throw error
        continue
      }

      throw error
    }
  }
}

function next_claim_time(now: Date): Date {
  return new Date(now.getTime() + CLAIM_COOLDOWN_MS)
}

function next_reroll_time(now: Date): Date {
  return new Date(now.getTime() + REROLL_COOLDOWN_MS)
}

export class WaifuService {
  private async resolve_character_by_query(input: { query: string }): Promise<
    | { success: true; character: { id: string; name: string; nameNative: string | null; imageUrl: string; gender: string | null } }
    | { success: false; error: 'invalid_query' | 'not_found' | 'ambiguous'; message: string }
  > {
    const q = input.query.trim()
    if (!q) return { success: false as const, error: 'invalid_query', message: 'Informe o nome do personagem.' }

    const local = await prisma.waifuCharacter.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, name: true, nameNative: true, imageUrl: true, gender: true },
    })

    if (local.length === 1) {
      return { success: true as const, character: local[0] }
    }

    if (local.length > 1) {
      return {
        success: false as const,
        error: 'ambiguous',
        message: 'Encontrei mais de um resultado. Seja mais específico:\n' + local.map((c) => `- ${c.name}`).join('\n'),
      }
    }

    const results = await aniListService.search_character_by_name({ name: q })
    if (results.length === 0) {
      return { success: false as const, error: 'not_found', message: 'Personagem não encontrado.' }
    }

    if (results.length > 1) {
      return {
        success: false as const,
        error: 'ambiguous',
        message:
          'Encontrei mais de um resultado. Seja mais específico:\n' +
          results
            .slice(0, 10)
            .map((c) => `- ${c.name.full ?? 'Unknown'}`)
            .join('\n'),
      }
    }

    const top = results[0]

    const upserted = await prisma.waifuCharacter.upsert({
      where: { source_sourceId: { source: 'ANILIST', sourceId: top.id } },
      update: {
        name: top.name.full ?? 'Unknown',
        nameNative: top.name.native,
        imageUrl: top.image.large ?? '',
        gender: top.gender,
      },
      create: {
        source: 'ANILIST',
        sourceId: top.id,
        name: top.name.full ?? 'Unknown',
        nameNative: top.name.native,
        imageUrl: top.image.large ?? '',
        gender: top.gender,
      },
      select: { id: true, name: true, nameNative: true, imageUrl: true, gender: true },
    })

    return { success: true as const, character: upserted }
  }

  async ensure_user(userId: string, input: { username?: string | null; avatar?: string | null }): Promise<void> {
    await prisma.user.upsert({
      where: { id: userId },
      update: { username: input.username ?? undefined, avatar: input.avatar ?? undefined },
      create: { id: userId, username: input.username ?? null, avatar: input.avatar ?? null },
    })
  }

  async roll(input: {
    kind: waifu_roll_kind
    desiredGenderOverride?: desired_gender
    guildId: string
    channelId: string
    rolledByUserId: string
  }): Promise<roll_result> {
    await this.ensure_user(input.rolledByUserId, { username: null, avatar: null })

    const desiredGender: desired_gender =
      input.desiredGenderOverride ?? (input.kind === 'waifu' ? 'female' : input.kind === 'husbando' ? 'male' : 'any')

    const rolled = await aniListService.roll_character({ desiredGender })

    const character = await prisma.waifuCharacter.upsert({
      where: {
        source_sourceId: {
          source: 'ANILIST',
          sourceId: rolled.id,
        },
      },
      update: {
        name: rolled.name.full ?? 'Unknown',
        nameNative: rolled.name.native,
        imageUrl: rolled.image.large ?? '',
        gender: rolled.gender,
      },
      create: {
        source: 'ANILIST',
        sourceId: rolled.id,
        name: rolled.name.full ?? 'Unknown',
        nameNative: rolled.name.native,
        imageUrl: rolled.image.large ?? '',
        gender: rolled.gender,
      },
      select: {
        id: true,
        source: true,
        sourceId: true,
        name: true,
        nameNative: true,
        imageUrl: true,
        gender: true,
      },
    })

    const existing_claim = await prisma.waifuClaim.findUnique({
      where: { guildId_characterId: { guildId: input.guildId, characterId: character.id } },
      select: { userId: true },
    })

    const expiresAt = new Date(Date.now() + ROLL_EXPIRES_MS)

    const roll = await prisma.waifuRoll.create({
      data: {
        guildId: input.guildId,
        channelId: input.channelId,
        messageId: null,
        kind: input.kind,
        desiredGender,
        rolledByUserId: input.rolledByUserId,
        characterId: character.id,
        expiresAt,
      },
      select: { id: true },
    })

    return {
      rollId: roll.id,
      character: {
        id: character.id,
        source: 'ANILIST',
        sourceId: character.sourceId,
        name: character.name,
        nameNative: character.nameNative,
        imageUrl: character.imageUrl,
        gender: character.gender,
      },
      claimedByUserId: existing_claim?.userId ?? null,
      expiresAt,
    }
  }

  async attach_message_id(input: { rollId: string; messageId: string }): Promise<void> {
    await prisma.waifuRoll.update({ where: { id: input.rollId }, data: { messageId: input.messageId } })
  }

  async claim(input: { rollId: string; userId: string; now?: Date }): Promise<claim_result> {
    const now = input.now ?? new Date()

    return await with_serializable_retry(async (tx) => {
      await tx.user.upsert({
        where: { id: input.userId },
        update: {},
        create: { id: input.userId, username: null, avatar: null },
      })

      const roll = await tx.waifuRoll.findUnique({
        where: { id: input.rollId },
        include: {
          character: { select: { id: true, name: true } },
        },
      })

      if (!roll) {
        return { success: false as const, error: 'not_found', message: 'Rolagem não encontrada.' }
      }

      if (roll.expiresAt.getTime() < now.getTime()) {
        return { success: false as const, error: 'expired', message: 'Esta rolagem expirou.' }
      }

      if (roll.claimedByUserId) {
        return {
          success: false as const,
          error: 'already_claimed',
          message: 'Esta rolagem já foi reivindicada.',
          claimedByUserId: roll.claimedByUserId,
        }
      }

      // Anti-snipe: primeiros segundos só o roller pode claimar
      const createdAt = roll.createdAt
      if (now.getTime() - createdAt.getTime() < SNIPE_PROTECT_MS && roll.rolledByUserId !== input.userId) {
        return {
          success: false as const,
          error: 'snipe_protected',
          message: 'Ainda está protegido contra snipe. Aguarde alguns segundos ou deixe quem rolou casar.',
        }
      }

      const existing_claim = await tx.waifuClaim.findUnique({
        where: { guildId_characterId: { guildId: roll.guildId, characterId: roll.characterId } },
        select: { userId: true },
      })

      if (existing_claim) {
        await tx.waifuRoll.update({
          where: { id: roll.id },
          data: { claimedByUserId: existing_claim.userId, claimedAt: now },
        })

        return {
          success: false as const,
          error: 'already_claimed',
          message: 'Este personagem já está casado neste servidor.',
          claimedByUserId: existing_claim.userId,
        }
      }

      const state = await tx.waifuUserState.findUnique({
        where: { guildId_userId: { guildId: roll.guildId, userId: input.userId } },
      })

      if (state?.nextClaimAt && state.nextClaimAt.getTime() > now.getTime()) {
        return {
          success: false as const,
          error: 'cooldown',
          message: 'Você ainda está no cooldown de claim.',
          nextClaimAt: state.nextClaimAt,
        }
      }

      const nextClaimAt = next_claim_time(now)

      await tx.waifuClaim.create({
        data: {
          guildId: roll.guildId,
          userId: input.userId,
          characterId: roll.characterId,
          claimedAt: now,
        },
      })

      await tx.waifuUserState.upsert({
        where: { guildId_userId: { guildId: roll.guildId, userId: input.userId } },
        update: { nextClaimAt },
        create: { guildId: roll.guildId, userId: input.userId, nextClaimAt },
      })

      await tx.waifuRoll.update({
        where: { id: roll.id },
        data: { claimedByUserId: input.userId, claimedAt: now },
      })

      return {
        success: true as const,
        characterName: roll.character.name,
        claimerUserId: input.userId,
        nextClaimAt,
      }
    })
  }

  async reroll(input: { guildId: string; channelId: string; userId: string; now?: Date }): Promise<reroll_result> {
    const now = input.now ?? new Date()

    return await with_serializable_retry(async (tx) => {
      await tx.user.upsert({
        where: { id: input.userId },
        update: {},
        create: { id: input.userId, username: null, avatar: null },
      })

      const old = await tx.waifuRoll.findFirst({
        where: { guildId: input.guildId, channelId: input.channelId, rolledByUserId: input.userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kind: true,
          desiredGender: true,
          messageId: true,
          expiresAt: true,
          claimedByUserId: true,
        },
      })

      if (!old) {
        return { success: false as const, error: 'not_found', message: 'Você ainda não rolou nada neste canal.' }
      }

      if (old.claimedByUserId) {
        return {
          success: false as const,
          error: 'already_claimed',
          message: 'Seu último roll já foi casado. Role novamente para rerolar.',
        }
      }

      if (old.expiresAt.getTime() < now.getTime()) {
        return {
          success: false as const,
          error: 'expired',
          message: 'Seu último roll já expirou. Role novamente para rerolar.',
        }
      }

      const state = await tx.waifuUserState.findUnique({
        where: { guildId_userId: { guildId: input.guildId, userId: input.userId } },
        select: { nextRerollAt: true },
      })

      if (state?.nextRerollAt && state.nextRerollAt.getTime() > now.getTime()) {
        return {
          success: false as const,
          error: 'cooldown',
          message: 'Você ainda está no cooldown de reroll.',
          nextRerollAt: state.nextRerollAt,
        }
      }

      const nextRerollAt = next_reroll_time(now)

      const desiredGender: desired_gender =
        (old.desiredGender as desired_gender | null) ??
        ((old.kind as waifu_roll_kind) === 'waifu' ? 'female' : (old.kind as waifu_roll_kind) === 'husbando' ? 'male' : 'any')

      const rolled = await aniListService.roll_character({ desiredGender })

      const character = await tx.waifuCharacter.upsert({
        where: {
          source_sourceId: {
            source: 'ANILIST',
            sourceId: rolled.id,
          },
        },
        update: {
          name: rolled.name.full ?? 'Unknown',
          nameNative: rolled.name.native,
          imageUrl: rolled.image.large ?? '',
          gender: rolled.gender,
        },
        create: {
          source: 'ANILIST',
          sourceId: rolled.id,
          name: rolled.name.full ?? 'Unknown',
          nameNative: rolled.name.native,
          imageUrl: rolled.image.large ?? '',
          gender: rolled.gender,
        },
        select: {
          id: true,
          source: true,
          sourceId: true,
          name: true,
          nameNative: true,
          imageUrl: true,
          gender: true,
        },
      })

      const existing_claim = await tx.waifuClaim.findUnique({
        where: { guildId_characterId: { guildId: input.guildId, characterId: character.id } },
        select: { userId: true },
      })

      const expiresAt = new Date(now.getTime() + ROLL_EXPIRES_MS)
      const created_roll = await tx.waifuRoll.create({
        data: {
          guildId: input.guildId,
          channelId: input.channelId,
          messageId: null,
          kind: old.kind as string,
          desiredGender,
          rolledByUserId: input.userId,
          characterId: character.id,
          expiresAt,
        },
        select: { id: true },
      })

      // Invalidate old roll (prevents claiming it after reroll)
      await tx.waifuRoll.update({
        where: { id: old.id },
        data: { expiresAt: new Date(now.getTime() - 1) },
      })

      await tx.waifuUserState.upsert({
        where: { guildId_userId: { guildId: input.guildId, userId: input.userId } },
        update: { nextRerollAt },
        create: { guildId: input.guildId, userId: input.userId, nextRerollAt },
      })

      return {
        success: true as const,
        kind: old.kind as waifu_roll_kind,
        oldRollId: old.id,
        oldMessageId: old.messageId,
        nextRerollAt,
        newRoll: {
          rollId: created_roll.id,
          character: {
            id: character.id,
            source: 'ANILIST',
            sourceId: character.sourceId,
            name: character.name,
            nameNative: character.nameNative,
            imageUrl: character.imageUrl,
            gender: character.gender,
          },
          claimedByUserId: existing_claim?.userId ?? null,
          expiresAt,
        },
      }
    })
  }

  async list_harem(input: { guildId: string; userId: string; page: number; pageSize: number }) {
    const page = Math.max(1, input.page)
    const pageSize = Math.min(25, Math.max(1, input.pageSize))

    const total = await prisma.waifuClaim.count({ where: { guildId: input.guildId, userId: input.userId } })

    const claims = await prisma.waifuClaim.findMany({
      where: { guildId: input.guildId, userId: input.userId },
      orderBy: { claimedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { character: true },
    })

    return { total, page, pageSize, claims }
  }

  async wishlist_add(input: { guildId: string; userId: string; query: string }): Promise<wishlist_add_result> {
    const resolved = await this.resolve_character_by_query({ query: input.query })
    if (resolved.success === false) return resolved

    await this.ensure_user(input.userId, { username: null, avatar: null })

    try {
      await prisma.waifuWishlist.create({
        data: {
          guildId: input.guildId,
          userId: input.userId,
          characterId: resolved.character.id,
        },
      })
    } catch (error) {
      const err = error as { code?: unknown }
      const code = typeof err.code === 'string' ? err.code : ''

      // Unique constraint
      if (code === 'P2002') {
        return {
          success: false as const,
          error: 'already_exists',
          message: 'Este personagem já está na sua wishlist.',
        }
      }

      throw error
    }

    return { success: true as const, characterId: resolved.character.id, characterName: resolved.character.name }
  }

  async wishlist_remove(input: { guildId: string; userId: string; query: string }): Promise<wishlist_remove_result> {
    const resolved = await this.resolve_character_by_query({ query: input.query })
    if (resolved.success === false) return resolved

    const existing = await prisma.waifuWishlist.findUnique({
      where: { guildId_userId_characterId: { guildId: input.guildId, userId: input.userId, characterId: resolved.character.id } },
      select: { id: true },
    })

    if (!existing) {
      return {
        success: false as const,
        error: 'not_found',
        message: 'Este personagem não está na sua wishlist.',
      }
    }

    await prisma.waifuWishlist.delete({ where: { id: existing.id } })

    return { success: true as const, characterId: resolved.character.id, characterName: resolved.character.name }
  }

  async wishlist_list(input: { guildId: string; userId: string; page: number; pageSize: number }) {
    const page = Math.max(1, input.page)
    const pageSize = Math.min(25, Math.max(1, input.pageSize))

    const total = await prisma.waifuWishlist.count({ where: { guildId: input.guildId, userId: input.userId } })

    const items = await prisma.waifuWishlist.findMany({
      where: { guildId: input.guildId, userId: input.userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { character: true },
    })

    return { total, page, pageSize, items }
  }

  async wishlist_watchers(input: { guildId: string; characterId: string }) {
    const rows = await prisma.waifuWishlist.findMany({
      where: { guildId: input.guildId, characterId: input.characterId },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    })

    return { userIds: rows.map((r) => r.userId) }
  }

  async divorce(input: { guildId: string; userId: string; query: string }) {
    const q = input.query.trim()
    if (!q) return { success: false as const, error: 'invalid_query' as const, message: 'Informe o nome do personagem.' }

    const matches = await prisma.waifuClaim.findMany({
      where: {
        guildId: input.guildId,
        userId: input.userId,
        character: { name: { contains: q, mode: 'insensitive' } },
      },
      include: { character: true },
      orderBy: { claimedAt: 'desc' },
      take: 10,
    })

    if (matches.length === 0) {
      return { success: false as const, error: 'not_found' as const, message: 'Você não tem nenhum personagem com esse nome no seu harem.' }
    }

    if (matches.length > 1) {
      return {
        success: false as const,
        error: 'ambiguous' as const,
        message:
          'Encontrei mais de um resultado. Seja mais específico:\n' +
          matches.map((m) => `- ${m.character.name}`).join('\n'),
      }
    }

    const target = matches[0]
    await prisma.waifuClaim.delete({ where: { id: target.id } })

    return { success: true as const, characterName: target.character.name }
  }

  async info(input: { guildId: string; query: string }) {
    const q = input.query.trim()
    if (!q) return { success: false as const, error: 'invalid_query' as const, message: 'Informe o nome do personagem.' }

    const local = await prisma.waifuCharacter.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    })

    if (local.length === 1) {
      const c = local[0]
      const claim = await prisma.waifuClaim.findUnique({
        where: { guildId_characterId: { guildId: input.guildId, characterId: c.id } },
        select: { userId: true },
      })

      return { success: true as const, character: c, claimedByUserId: claim?.userId ?? null }
    }

    if (local.length > 1) {
      return {
        success: false as const,
        error: 'ambiguous' as const,
        message: 'Encontrei mais de um resultado. Seja mais específico:\n' + local.map((c) => `- ${c.name}`).join('\n'),
      }
    }

    const results = await aniListService.search_character_by_name({ name: q })
    if (results.length === 0) {
      return { success: false as const, error: 'not_found' as const, message: 'Personagem não encontrado.' }
    }

    const top = results[0]

    const upserted = await prisma.waifuCharacter.upsert({
      where: { source_sourceId: { source: 'ANILIST', sourceId: top.id } },
      update: {
        name: top.name.full ?? 'Unknown',
        nameNative: top.name.native,
        imageUrl: top.image.large ?? '',
        gender: top.gender,
      },
      create: {
        source: 'ANILIST',
        sourceId: top.id,
        name: top.name.full ?? 'Unknown',
        nameNative: top.name.native,
        imageUrl: top.image.large ?? '',
        gender: top.gender,
      },
    })

    const claim = await prisma.waifuClaim.findUnique({
      where: { guildId_characterId: { guildId: input.guildId, characterId: upserted.id } },
      select: { userId: true },
    })

    return { success: true as const, character: upserted, claimedByUserId: claim?.userId ?? null }
  }
}

export const waifuService = new WaifuService()
