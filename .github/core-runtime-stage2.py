from pathlib import Path
import re

def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))

# 1) GamerPower: real read-through cache.
path = 'apps/bot/src/services/gamerpower.service.ts'
p = Path(path)
text = p.read_text()
old = '''  async getAllGiveaways(options?: GetAllGiveawaysOptions): Promise<GamerPowerGiveaway[]> {
    const primary_url = this.build_giveaways_url(options)

    try {
'''
new = '''  async getAllGiveaways(options?: GetAllGiveawaysOptions): Promise<GamerPowerGiveaway[]> {
    const primary_url = this.build_giveaways_url(options)
    const cached = this.get_cache<GamerPowerGiveaway[]>(primary_url)
    if (cached) return cached

    try {
'''
if old not in text: raise SystemExit('gamerpower getAllGiveaways marker missing')
text = text.replace(old, new, 1)
text = text.replace(
'''      const cached = this.get_cache<GamerPowerGiveaway[]>(primary_url)
      if (cached) {
        logger.warn(
          { err: safe_error_details(error), url: primary_url },
          'GamerPower giveaways request failed; using cached response'
        )
        return cached
      }
''',
'''      const stale_cache = this.get_cache<GamerPowerGiveaway[]>(primary_url)
      if (stale_cache) {
        logger.warn(
          { err: safe_error_details(error), url: primary_url },
          'GamerPower giveaways request failed; using cached response'
        )
        return stale_cache
      }
''', 1)
p.write_text(text)

path = 'apps/bot/src/services/gamerpower.service.test.ts'
p = Path(path)
text = p.read_text()
text = text.replace(
"test('GamerPowerService.getAllGiveaways: uses cached response after transient network failure', async () => {",
"test('GamerPowerService.getAllGiveaways: serves a fresh cached response without a second HTTP request', async () => {",
1)
old = '''    if (calls.length === 1) {
      return { data: cached as unknown as T }
    }

    const err: any = new Error('socket reset')
    err.code = 'ECONNRESET'
    throw err
'''
new = '''    return { data: cached as unknown as T }
'''
if old not in text: raise SystemExit('gamerpower cache test body missing')
text = text.replace(old, new, 1)
pos = text.rfind("  assert.equal(calls.length, 2)\n")
if pos < 0: raise SystemExit('gamerpower cache assertion missing')
text = text[:pos] + "  assert.equal(calls.length, 1)\n" + text[pos+len("  assert.equal(calls.length, 2)\n"):]
p.write_text(text)

# 2) Free-game scheduler: fetch catalog once per cycle and filter locally.
path = 'apps/bot/src/services/freeGameScheduler.ts'
p = Path(path)
text = p.read_text()
marker = "\n// ============================================\n// Helper Functions - PT-BR localization"
idx = text.index(marker)
helper = '''

function matchesGuildGiveawayFilters(
  giveaway: GamerPowerGiveaway,
  config: { platforms: string[]; giveawayTypes: string[] }
): boolean {
  const configured_platforms = new Set(config.platforms.map((platform) => platform.toLowerCase()))
  const giveaway_platforms = normalizePlatforms(giveaway.platforms).map((platform) => platform.toLowerCase())
  const platform_matches =
    configured_platforms.size === 0 ||
    giveaway_platforms.some((platform) => configured_platforms.has(platform))

  const configured_types = new Set(config.giveawayTypes.map((type) => type.toLowerCase()))
  const type_matches =
    configured_types.size === 0 ||
    configured_types.has(String(giveaway.type ?? '').toLowerCase())

  return platform_matches && type_matches
}
'''
text = text[:idx] + helper + text[idx:]

old = '''      logger.info(`🎮 Verificando jogos grátis para ${guildConfigs.length} guild(s)`)

      // Para cada guild, verificar e notificar
      for (const config of guildConfigs) {
'''
new = '''      logger.info(`🎮 Verificando jogos grátis para ${guildConfigs.length} guild(s)`)

      // O catálogo é global. Buscar uma vez por ciclo evita uma chamada externa por guild.
      const catalog = await gamerPowerService.getAllGiveaways({ sortBy: 'date' })
      if (catalog.length === 0) {
        logger.debug('Nenhum giveaway ativo retornado pela GamerPower')
        return
      }

      // Para cada guild, filtrar o catálogo localmente e notificar.
      for (const config of guildConfigs) {
'''
if old not in text: raise SystemExit('freegame batch marker missing')
text = text.replace(old, new, 1)
text = text.replace("        await this.processGuild(processedConfig).catch((err) => {", "        await this.processGuild(processedConfig, catalog).catch((err) => {", 1)

old_sig = '''  private async processGuild(config: {
    guildId: string
    channelId: string | null
    roleIds: string[]
    platforms: string[]
    giveawayTypes: string[]
  }) {
'''
new_sig = '''  private async processGuild(config: {
    guildId: string
    channelId: string | null
    roleIds: string[]
    platforms: string[]
    giveawayTypes: string[]
  }, catalog?: GamerPowerGiveaway[]) {
'''
if old_sig not in text: raise SystemExit('freegame processGuild sig missing')
text = text.replace(old_sig, new_sig, 1)

old_fetch = '''    // Buscar giveaways da API
    const giveaways = await gamerPowerService.getAllGiveaways({
      platforms: config.platforms.length > 0 ? config.platforms : undefined,
      types: config.giveawayTypes.length > 0 ? config.giveawayTypes : undefined,
      sortBy: 'date',
    })
'''
new_fetch = '''    const giveaways = catalog
      ? catalog.filter((giveaway) => matchesGuildGiveawayFilters(giveaway, config))
      : await gamerPowerService.getAllGiveaways({
          platforms: config.platforms.length > 0 ? config.platforms : undefined,
          types: config.giveawayTypes.length > 0 ? config.giveawayTypes : undefined,
          sortBy: 'date',
        })
'''
if old_fetch not in text: raise SystemExit('freegame per-guild fetch missing')
text = text.replace(old_fetch, new_fetch, 1)

old_ann = '''    // Buscar giveaways já anunciados para esta guild
    const announcedGiveaways = await prisma.freeGameGiveaway.findMany({
      where: { guildId: config.guildId },
      select: { giveawayId: true },
    })
'''
new_ann = '''    // Consultar apenas IDs presentes no catálogo atual, não todo o histórico da guild.
    const current_giveaway_ids = giveaways.map((giveaway) => String(giveaway.id))
    const announcedGiveaways = await prisma.freeGameGiveaway.findMany({
      where: {
        guildId: config.guildId,
        giveawayId: { in: current_giveaway_ids },
      },
      select: { giveawayId: true },
    })
'''
if old_ann not in text: raise SystemExit('freegame announced lookup missing')
text = text.replace(old_ann, new_ann, 1)
p.write_text(text)

path = 'apps/bot/src/services/freeGameScheduler.test.ts'
p = Path(path)
text = p.read_text()
append = '''

test('free-game scheduler fetches the GamerPower catalog once for multiple guilds', async () => {
  const original_configs = (prisma.freeGameNotification as any).findMany
  const original_get_all = (gamerPowerService as any).getAllGiveaways
  const original_debug = (logger as any).debug
  const original_info = (logger as any).info

  let catalog_calls = 0
  try {
    ;(logger as any).debug = () => undefined
    ;(logger as any).info = () => undefined

    ;(prisma.freeGameNotification as any).findMany = async () => [
      {
        guildId: 'guild-1',
        channelId: 'channel-1',
        roleIds: [],
        platforms: [],
        giveawayTypes: [],
      },
      {
        guildId: 'guild-2',
        channelId: 'channel-2',
        roleIds: [],
        platforms: ['steam'],
        giveawayTypes: ['game'],
      },
    ]

    ;(gamerPowerService as any).getAllGiveaways = async () => {
      catalog_calls += 1
      return []
    }

    const scheduler = new FreeGameScheduler({} as any)
    await (scheduler as any).processGuildNotifications()

    assert.equal(catalog_calls, 1)
  } finally {
    ;(prisma.freeGameNotification as any).findMany = original_configs
    ;(gamerPowerService as any).getAllGiveaways = original_get_all
    ;(logger as any).debug = original_debug
    ;(logger as any).info = original_info
  }
})
'''
if 'fetches the GamerPower catalog once for multiple guilds' not in text:
    text += append
p.write_text(text)

# 3) Birthdays: query only upcoming dates, then only matching guild members.
path = 'apps/bot/src/services/birthday.service.ts'
p = Path(path)
text = p.read_text()
start = text.index("export async function getUpcomingBirthdays(")
prefix = text[:start]
replacement = '''export async function getUpcomingBirthdays(
  guildId: string,
  daysAhead: number = 30
): Promise<{ birthday: user_birthday; userId: string; username: string; avatar: string | null }[]> {
  const now = new Date()
  const safe_days_ahead = Math.max(0, Math.min(366, Math.floor(daysAhead)))
  const day_month_pairs = new Map<string, { day: number; month: number; offset: number }>()

  for (let offset = 0; offset <= safe_days_ahead; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12)
    const day = date.getDate()
    const month = date.getMonth() + 1
    const key = `${month}:${day}`
    if (!day_month_pairs.has(key)) {
      day_month_pairs.set(key, { day, month, offset })
    }

    // Preserve the previous JavaScript Date behavior for Feb 29 birthdays:
    // in non-leap years, new Date(year, 1, 29) normalizes to March 1.
    if (month === 3 && day === 1) {
      const feb_last_day = new Date(date.getFullYear(), 2, 0).getDate()
      if (feb_last_day === 28 && !day_month_pairs.has('2:29')) {
        day_month_pairs.set('2:29', { day: 29, month: 2, offset })
      }
    }
  }

  const birthdays = await prisma.userBirthday.findMany({
    where: {
      OR: Array.from(day_month_pairs.values()).map(({ day, month }) => ({ day, month })),
    },
    select: {
      id: true,
      userId: true,
      day: true,
      month: true,
      year: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (birthdays.length === 0) return []

  const user_ids = birthdays.map((birthday) => birthday.userId)
  const guild_members = await prisma.guildMember.findMany({
    where: {
      guildId,
      userId: { in: user_ids },
    },
    select: {
      userId: true,
      username: true,
      avatar: true,
    },
  })

  const member_by_id = new Map(
    guild_members.map((member) => [member.userId, { username: member.username, avatar: member.avatar }])
  )

  return birthdays
    .flatMap((birthday) => {
      const member = member_by_id.get(birthday.userId)
      if (!member) return []

      const offset = day_month_pairs.get(`${birthday.month}:${birthday.day}`)?.offset
      if (offset === undefined || offset > safe_days_ahead) return []

      return [{
        birthday,
        userId: birthday.userId,
        username: member.username,
        avatar: member.avatar,
        offset,
      }]
    })
    .sort((a, b) => a.offset - b.offset)
    .map(({ offset: _offset, ...item }) => item)
}
'''
p.write_text(prefix + replacement)

# 4) Reuse GuildResourceCache for XP config.
path = 'apps/bot/src/services/xp.service.ts'
p = Path(path)
text = p.read_text()
import_marker = "import { with_serializable_retry } from '../utils/prisma-transaction';\n"
if import_marker not in text: raise SystemExit('xp import marker missing')
text = text.replace(import_marker, import_marker + "import { GuildResourceCache } from '../utils/guild_resource_cache';\n", 1)
old_fields = '''  private config_cache: Map<string, { config: GuildXpConfig | null; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private xp_boost_cache: Map<string, { multiplier: number; timestamp: number }> = new Map()
'''
new_fields = '''  private readonly config_cache = new GuildResourceCache<GuildXpConfig | null>(
    async (guild_id) => {
      try {
        return await prisma.guildXpConfig.findUnique({ where: { guildId: guild_id } })
      } catch (error) {
        logger.error({ error, guildId: guild_id }, 'Erro ao buscar config de XP')
        return null
      }
    },
    { cache_ttl_ms: 5 * 60 * 1000, max_entries: 2000 },
  )

  private xp_boost_cache: Map<string, { multiplier: number; timestamp: number }> = new Map()
'''
if old_fields not in text: raise SystemExit('xp cache fields missing')
text = text.replace(old_fields, new_fields, 1)
text = text.replace("    this.config_cache.delete(guild_id);\n", "    this.config_cache.invalidate(guild_id);\n", 1)
old_method = '''  private async get_guild_xp_config(guild_id: string): Promise<GuildXpConfig | null> {
    const cached = this.config_cache.get(guild_id);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.config;
    }

    try {
      const config = await prisma.guildXpConfig.findUnique({ where: { guildId: guild_id } });
      this.config_cache.set(guild_id, { config, timestamp: now });
      return config;
    } catch (error) {
      logger.error({ error, guildId: guild_id }, 'Erro ao buscar config de XP');
      this.config_cache.set(guild_id, { config: null, timestamp: now });
      return null;
    }
  }
'''
new_method = '''  private async get_guild_xp_config(guild_id: string): Promise<GuildXpConfig | null> {
    return this.config_cache.get(guild_id)
  }
'''
if old_method not in text: raise SystemExit('xp get config method missing')
text = text.replace(old_method, new_method, 1)
p.write_text(text)

# 5) AutoMod cache.
path = 'apps/bot/src/services/automod.service.ts'
p = Path(path)
text = p.read_text()
import_marker = "import { safe_error_details } from '../utils/safe_error'\n"
if import_marker not in text: raise SystemExit('automod import marker missing')
text = text.replace(import_marker, import_marker + "import { GuildResourceCache } from '../utils/guild_resource_cache'\n", 1)
old_fields = '''class AutoModService {
  private configCache: Map<string, { config: GuildConfig | null; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

'''
new_fields = '''class AutoModService {
  private readonly configCache = new GuildResourceCache<GuildConfig | null>(
    (guildId) => prisma.guildConfig.findUnique({ where: { guildId } }),
    { cache_ttl_ms: 5 * 60 * 1000, max_entries: 2000 },
  )

'''
if old_fields not in text: raise SystemExit('automod cache fields missing')
text = text.replace(old_fields, new_fields, 1)
old_method = '''  private async getGuildConfig(guildId: string): Promise<GuildConfig | null> {
    const cached = this.configCache.get(guildId);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.config;
    }

    try {
      const config = await prisma.guildConfig.findUnique({
        where: { guildId },
      });

      this.configCache.set(guildId, { config, timestamp: now });
      return config;
    } catch (error) {
      logger.error({ error }, 'Erro ao buscar config do guild');
      return null;
    }
  }
'''
new_method = '''  private async getGuildConfig(guildId: string): Promise<GuildConfig | null> {
    try {
      return await this.configCache.get(guildId)
    } catch (error) {
      logger.error({ error, guildId }, 'Erro ao buscar config do guild')
      return null
    }
  }
'''
if old_method not in text: raise SystemExit('automod get config method missing')
text = text.replace(old_method, new_method, 1)
text = text.replace("    this.configCache.delete(guildId);\n", "    this.configCache.invalidate(guildId);\n", 1)
p.write_text(text)

# 6) Autorole cache.
path = 'apps/bot/src/services/autorole.service.ts'
p = Path(path)
text = p.read_text()
import_marker = "import { AutorolePendingIndex } from './autorole_pending_index'\n"
if import_marker not in text: raise SystemExit('autorole import marker missing')
text = text.replace(import_marker, import_marker + "import { GuildResourceCache } from '../utils/guild_resource_cache'\n", 1)
old_head = '''class AutoroleService {
  private config_cache: Map<string, { config: autorole_config; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000
  private readonly pending_first_message_index = new AutorolePendingIndex(
'''
new_head = '''class AutoroleService {
  private readonly config_cache = new GuildResourceCache<autorole_config>(
    (guild_id) => this.load_guild_config(guild_id),
    { cache_ttl_ms: 5 * 60 * 1000, max_entries: 2000 },
  )
  private readonly pending_first_message_index = new AutorolePendingIndex(
'''
if old_head not in text: raise SystemExit('autorole cache head missing')
text = text.replace(old_head, new_head, 1)
method_start = text.index("  private async get_guild_config(guild_id: string): Promise<autorole_config> {\n")
method_end = text.index("\n  clear_cache(guild_id: string) {", method_start)
old_method = text[method_start:method_end]
config_row_idx = old_method.index("    const config_row = await prisma.guildAutoroleConfig.findUnique({")
loader_body = old_method[config_row_idx:]
loader_body = loader_body.replace("    const now = Date.now()\n", "")
loader_body = re.sub(r"\n\s*this\.config_cache\.set\(guild_id, \{ config, timestamp: now \}\)", "", loader_body)
if loader_body.endswith("\n  }"):
    loader_body = loader_body[:-4]
new_methods = "  private async load_guild_config(guild_id: string): Promise<autorole_config> {\n" + loader_body + "\n  }\n\n  private async get_guild_config(guild_id: string): Promise<autorole_config> {\n    return this.config_cache.get(guild_id)\n  }\n"
text = text[:method_start] + new_methods + text[method_end:]
text = text.replace("    this.config_cache.delete(guild_id)\n", "    this.config_cache.invalidate(guild_id)\n", 1)
p.write_text(text)

# 7) Settings GETs become read-only.
path = 'apps/api/src/routes/guilds/settings.routes.ts'
p = Path(path)
text = p.read_text()
patterns = [
('''    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: {
          welcomeChannelId: true,
          leaveChannelId: true,
          welcomeMessage: true,
          leaveMessage: true,
        },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))
''',
'''    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: {
        welcomeChannelId: true,
        leaveChannelId: true,
        welcomeMessage: true,
        leaveMessage: true,
      },
    })
'''),
('''        welcomeChannelId: config.welcomeChannelId,
        leaveChannelId: config.leaveChannelId,
        welcomeMessage: config.welcomeMessage,
        leaveMessage: config.leaveMessage,
''',
'''        welcomeChannelId: config?.welcomeChannelId ?? null,
        leaveChannelId: config?.leaveChannelId ?? null,
        welcomeMessage: config?.welcomeMessage ?? null,
        leaveMessage: config?.leaveMessage ?? null,
'''),
('''    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: { announcementChannelId: true },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))
''',
'''    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: { announcementChannelId: true },
    })
'''),
('''      config: { announcementChannelId: config.announcementChannelId },
''',
'''      config: { announcementChannelId: config?.announcementChannelId ?? null },
'''),
('''    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: { giveawayChannelId: true },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))
''',
'''    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: { giveawayChannelId: true },
    })
'''),
('''      config: { giveawayChannelId: config.giveawayChannelId },
''',
'''      config: { giveawayChannelId: config?.giveawayChannelId ?? null },
'''),
('''    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: {
          prefix: true,
          locale: true,
          timezone: true,
          auditLogChannelId: true,
        },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))
''',
'''    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: {
        prefix: true,
        locale: true,
        timezone: true,
        auditLogChannelId: true,
      },
    })
'''),
('''        prefix: config.prefix ?? '/',
        locale: config.locale ?? 'pt-BR',
        timezone: config.timezone ?? 'America/Sao_Paulo',
        auditLogChannelId: config.auditLogChannelId,
''',
'''        prefix: config?.prefix ?? '/',
        locale: config?.locale ?? 'pt-BR',
        timezone: config?.timezone ?? 'America/Sao_Paulo',
        auditLogChannelId: config?.auditLogChannelId ?? null,
'''),
]
for old,new in patterns:
    if old not in text: raise SystemExit(f'settings route pattern missing: {old[:80]}')
    text = text.replace(old,new,1)
p.write_text(text)

# 8) XP/autorole config GETs become read-only, narrowed selects + explicit defaults.
path = 'apps/api/src/routes/guilds/xp.routes.ts'
p = Path(path)
text = p.read_text()
old = '''    const config =
      (await prisma.guildXpConfig.findUnique({ where: { guildId } })) ??
      (await prisma.guildXpConfig.create({ data: { guildId } }))
'''
new = '''    const config = await prisma.guildXpConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        xpMode: true,
        xpPerMessage: true,
        xpPerVoiceMinute: true,
        xpBonusMinLength: true,
        xpBonusAmount: true,
        dailyXpBonusEnabled: true,
        dailyXpBonusAmount: true,
        voiceXpEnabled: true,
        voiceXpRate: true,
        minMessageLength: true,
        minUniqueLength: true,
        typingCps: true,
        xpDivisorMin: true,
        xpDivisorMax: true,
        xpCap: true,
        ignoredChannelIds: true,
        ignoredRoleIds: true,
        roleXpMultipliers: true,
        rewardMode: true,
        levelUpEnabled: true,
        levelUpChannelId: true,
        levelUpMessage: true,
        voiceXpNotificationsEnabled: true,
      },
    })
'''
if old not in text: raise SystemExit('xp GET create pattern missing')
text = text.replace(old,new,1)
old = "    return reply.send({ success: true, config, rewards })\n"
new = '''    return reply.send({
      success: true,
      config: config ?? {
        enabled: true,
        xpMode: 'formula',
        xpPerMessage: 1,
        xpPerVoiceMinute: 1,
        xpBonusMinLength: 0,
        xpBonusAmount: 0,
        dailyXpBonusEnabled: false,
        dailyXpBonusAmount: 0,
        voiceXpEnabled: false,
        voiceXpRate: 10,
        minMessageLength: 5,
        minUniqueLength: 12,
        typingCps: 7,
        xpDivisorMin: 7,
        xpDivisorMax: 4,
        xpCap: 35,
        ignoredChannelIds: [],
        ignoredRoleIds: [],
        roleXpMultipliers: {},
        rewardMode: 'stack',
        levelUpEnabled: true,
        levelUpChannelId: null,
        levelUpMessage: null,
        voiceXpNotificationsEnabled: true,
      },
      rewards,
    })
'''
if old not in text: raise SystemExit('xp GET return marker missing')
text = text.replace(old,new,1)
old = '''    const config =
      (await prisma.guildAutoroleConfig.findUnique({ where: { guildId } })) ??
      (await prisma.guildAutoroleConfig.create({ data: { guildId } }))
'''
new = '''    const config = await prisma.guildAutoroleConfig.findUnique({
      where: { guildId },
      select: {
        enabled: true,
        delaySeconds: true,
        onlyAfterFirstMessage: true,
      },
    })
'''
if old not in text: raise SystemExit('autorole GET create pattern missing')
text = text.replace(old,new,1)
old = '''      config,
      roleIds: roles.map((role) => role.roleId),
'''
new = '''      config: config ?? {
        enabled: false,
        delaySeconds: 0,
        onlyAfterFirstMessage: false,
      },
      roleIds: roles.map((role) => role.roleId),
'''
if old not in text: raise SystemExit('autorole GET return pattern missing')
text = text.replace(old,new,1)
p.write_text(text)

# 9) Moderation GETs become read-only.
path = 'apps/api/src/routes/guilds/moderation.routes.ts'
p = Path(path)
text = p.read_text()
text = text.replace("    const config =\n      (await prisma.guildConfig.findUnique({", "    const config = await prisma.guildConfig.findUnique({", 1)
needle = '''      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))

    return reply.send({ success: true, config })
'''
if needle not in text: raise SystemExit('moderation automod fallback missing')
text = text.replace(needle, '''      })

    return reply.send({
      success: true,
      config: config ?? {
        muteRoleId: null,
        muteRoleIds: [],
        wordFilterEnabled: false,
        bannedWords: [],
        wordFilterWhitelistChannels: [],
        wordFilterWhitelistRoles: [],
        capsEnabled: false,
        capsThreshold: 70,
        capsMinLength: 10,
        capsAction: 'warn',
        capsWhitelistChannels: [],
        capsWhitelistRoles: [],
        linkFilterEnabled: false,
        linkBlockAll: false,
        bannedDomains: [],
        allowedDomains: [],
        linkAction: 'delete',
        linkTimeoutDuration: '5m',
        linkNoRoleEnabled: false,
        linkNoRoleAction: 'mute',
        linkNoRoleTimeoutDuration: '10m',
        linkNotifyEnabled: true,
        linkWhitelistChannels: [],
        linkWhitelistRoles: [],
        warnThresholds: [],
        warnExpiration: 30,
        aiModerationEnabled: false,
        aiModerationAction: 'delete',
        aiModerationLevel: 'medio',
        aiModerationThresholds: {},
      },
    })
''', 1)
old = '''    const config =
      (await prisma.guildConfig.findUnique({
        where: { guildId },
        select: { modLogChannelId: true, modLogMessage: true },
      })) ??
      (await prisma.guildConfig.create({ data: { guildId } }))
'''
new = '''    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: { modLogChannelId: true, modLogMessage: true },
    })
'''
if old not in text: raise SystemExit('modlog GET fallback missing')
text = text.replace(old,new,1)
text = text.replace(
'''        modLogChannelId: config.modLogChannelId,
        modLogMessage: config.modLogMessage,
''',
'''        modLogChannelId: config?.modLogChannelId ?? null,
        modLogMessage: config?.modLogMessage ?? null,
''',1)
p.write_text(text)
