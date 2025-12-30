import { z } from 'zod'

const embed_field_schema = z.object({
  name: z.string(),
  value: z.string(),
  inline: z.boolean().optional(),
})

const embed_schema = z
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

export function validate_extended_template(template: string): string | null {
  const trimmed = template.trim()
  if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) return null

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const validated = extended_message_schema.safeParse(parsed)
    if (validated.success) return null
    return validated.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ')
  } catch (error) {
    const err = error as Error
    return err.message
  }
}
