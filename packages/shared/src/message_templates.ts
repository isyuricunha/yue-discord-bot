import { z } from 'zod'

export type template_context = {
  user?: { id: string; username: string; tag?: string; discriminator?: string; avatarUrl?: string; nickname?: string }
  staff?: { id: string; username: string; tag?: string; discriminator?: string; avatarUrl?: string }
  guild?: { id: string; name: string; memberCount?: number; iconUrl?: string }
  level?: number
  xp?: number
  experience?: {
    ranking?: number
    nextLevel?: {
      level: number
      requiredXp: number
      totalXp: number
    }
  }
  reason?: string
  duration?: string
  punishment?: string
}

type embed_field = { name: string; value: string; inline?: boolean }

type simple_embed = {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: embed_field[]
  author?: { name?: string; icon_url?: string; url?: string }
  footer?: { text?: string; icon_url?: string }
  thumbnail?: { url?: string }
  image?: { url?: string }
}

export type rendered_message = { content?: string; embeds?: [simple_embed] }

const embed_field_schema = z.object({ name: z.string(), value: z.string(), inline: z.boolean().optional() })
const embed_schema: z.ZodType<simple_embed> = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    url: z.string().optional(),
    color: z.number().int().optional(),
    fields: z.array(embed_field_schema).optional(),
    author: z.object({ name: z.string().optional(), icon_url: z.string().optional(), url: z.string().optional() }).optional(),
    footer: z.object({ text: z.string().optional(), icon_url: z.string().optional() }).optional(),
    thumbnail: z.object({ url: z.string().optional() }).optional(),
    image: z.object({ url: z.string().optional() }).optional(),
  })
  .strict()

const extended_message_schema = z.object({ content: z.string().optional(), embed: embed_schema.optional() }).strict()

export type extended_template_validation_result =
  | { kind: 'text' }
  | { kind: 'extended'; success: true }
  | { kind: 'extended'; success: false; error: string }

export function validate_extended_discord_message_template(template: string): extended_template_validation_result {
  const trimmed = template.trim()
  if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    return { kind: 'text' }
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const validated = extended_message_schema.safeParse(parsed)
    if (validated.success) {
      return { kind: 'extended', success: true }
    }

    const message = validated.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ')
    return { kind: 'extended', success: false, error: message }
  } catch (error) {
    const err = error as Error
    return { kind: 'extended', success: false, error: err.message }
  }
}

function collect_placeholders(ctx: template_context): Record<string, string> {
  const map: Record<string, string> = {}

  const user = ctx.user
  if (user) {
    const user_tag = user.tag ?? (user.discriminator ? `${user.username}#${user.discriminator}` : user.username)
    map['user'] = user.username
    map['@user'] = `<@${user.id}>`
    map['user.id'] = user.id
    map['user.tag'] = user_tag
    if (user.discriminator) map['user.discriminator'] = user.discriminator
    if (user.avatarUrl) map['user.avatar'] = user.avatarUrl
    if (user.nickname) map['user.nickname'] = user.nickname
  }

  const staff = ctx.staff
  if (staff) {
    const staff_tag = staff.tag ?? (staff.discriminator ? `${staff.username}#${staff.discriminator}` : staff.username)
    map['staff'] = staff.username
    map['@staff'] = `<@${staff.id}>`
    map['staff.id'] = staff.id
    map['staff.tag'] = staff_tag
    if (staff.discriminator) map['staff.discriminator'] = staff.discriminator
    if (staff.avatarUrl) map['staff.avatar'] = staff.avatarUrl
  }

  const guild = ctx.guild
  if (guild) {
    map['guild'] = guild.name
    if (typeof guild.memberCount === 'number') map['guild-size'] = String(guild.memberCount)
    if (guild.iconUrl) map['guild-icon-url'] = guild.iconUrl
  }

  if (ctx.level !== undefined) map['level'] = String(ctx.level)
  if (ctx.xp !== undefined) map['xp'] = String(ctx.xp)

  const experience = ctx.experience
  if (experience?.ranking !== undefined) {
    map['experience.ranking'] = String(experience.ranking)
  }
  if (experience?.nextLevel) {
    map['experience.next-level'] = String(experience.nextLevel.level)
    map['experience.next-level.required-xp'] = String(experience.nextLevel.requiredXp)
    map['experience.next-level.total-xp'] = String(experience.nextLevel.totalXp)
  }
  if (ctx.reason !== undefined) map['reason'] = ctx.reason
  if (ctx.duration !== undefined) map['duration'] = ctx.duration
  if (ctx.punishment !== undefined) map['punishment'] = ctx.punishment

  return map
}

export function render_placeholders(input: string, ctx: template_context): string {
  const map = collect_placeholders(ctx)
  return input.replace(/\{([^{}]+)\}/g, (full, key: string) => {
    const normalized = String(key).trim()
    return Object.prototype.hasOwnProperty.call(map, normalized) ? map[normalized]! : full
  })
}

function deep_render(value: unknown, ctx: template_context): unknown {
  if (typeof value === 'string') return render_placeholders(value, ctx)
  if (Array.isArray(value)) return value.map((v) => deep_render(v, ctx))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = deep_render(v, ctx)
    return out
  }
  return value
}

export function render_discord_message_template(template: string, ctx: template_context): rendered_message {
  const trimmed = template.trim()

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const validated = extended_message_schema.safeParse(parsed)
      if (validated.success) {
        const rendered = deep_render(validated.data, ctx) as { content?: string; embed?: simple_embed }
        const payload: rendered_message = {}
        if (rendered.content && rendered.content.trim().length > 0) payload.content = rendered.content
        if (rendered.embed) payload.embeds = [rendered.embed]
        return payload
      }
    } catch {
      // ignore
    }
  }

  return { content: render_placeholders(template, ctx) }
}
