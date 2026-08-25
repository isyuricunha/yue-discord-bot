import { z } from 'zod'

const id = z.string().trim().min(1).max(128)

export const internal_moderation_body_schema = z.object({
  moderatorId: id,
  userId: id,
  reason: z.string().max(2000).optional(),
  duration: z.string().max(64).optional(),
  deleteMessageDays: z.number().int().min(0).max(7).optional(),
})
export type internal_moderation_body = z.infer<typeof internal_moderation_body_schema>

export const internal_panel_publish_body_schema = z.object({
  moderatorId: id,
  channelId: id,
})
export type internal_panel_publish_body = z.infer<typeof internal_panel_publish_body_schema>

export const internal_support_role_body_schema = z.object({ roleId: id })
export type internal_support_role_body = z.infer<typeof internal_support_role_body_schema>

export const internal_profile_body_schema = z.object({
  userId: id,
  bio: z.preprocess(
    (value) => typeof value === 'string' ? (value.trim() || null) : value,
    z.string().max(300).nullable(),
  ),
})
export type internal_profile_body = z.infer<typeof internal_profile_body_schema>

export const internal_send_message_body_schema = z.object({
  content: z.string().min(1).max(2000),
  imageUrl: z.string().max(2048).regex(/^https?:\/\//i).nullable().optional(),
})
export type internal_send_message_body = z.infer<typeof internal_send_message_body_schema>

export const internal_music_action_body_schema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['pause', 'resume', 'skip', 'stop']) }),
  z.object({ action: z.literal('volume'), volume: z.number().int().min(1).max(150) }),
])
export type internal_music_action_body = z.infer<typeof internal_music_action_body_schema>
