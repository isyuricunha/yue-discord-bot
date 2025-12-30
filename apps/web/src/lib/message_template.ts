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

const template_variant_schema = z.union([z.string(), extended_message_schema])
const template_variants_schema = z.array(template_variant_schema)

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

export function validate_extended_template_variants(template: string): string | null {
  const trimmed = template.trim()
  if (trimmed.length === 0) return null

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const validated = template_variants_schema.safeParse(parsed)
      if (!validated.success) return 'Formato inválido: esperado uma lista (JSON array)'

      for (let i = 0; i < validated.data.length; i++) {
        const item = validated.data[i]
        const index = i + 1

        if (typeof item === 'string') {
          const item_trimmed = item.trim()
          if (!item_trimmed) return `Item ${index}: mensagem vazia`

          const error = validate_extended_template(item)
          if (error) return `Item ${index}: ${error}`
          continue
        }

        const content = (item.content ?? '').trim()
        const embed = item.embed

        const has_non_empty_embed = !!(embed && Object.keys(embed).length > 0)
        if (!content && !has_non_empty_embed) {
          return `Item ${index}: mensagem vazia`
        }
      }

      return null
    } catch (error) {
      const err = error as Error
      return err.message
    }
  }

  return validate_extended_template(template)
}
