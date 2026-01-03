import { z } from 'zod';

// Moderation validators
export const banSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().optional(),
  deleteMessageDays: z.number().min(0).max(7).optional(),
});

export const kickSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().optional(),
});

export const muteSchema = z.object({
  userId: z.string().min(1),
  duration: z.string().regex(/^\d+[smhd]$/), // 1s, 5m, 2h, 3d
  reason: z.string().optional(),
});

export const memberModerationActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('ban'),
    reason: z.string().optional(),
    deleteMessageDays: z.number().min(0).max(7).optional(),
  }),
  z.object({
    action: z.literal('unban'),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('kick'),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('timeout'),
    duration: z.string().regex(/^\d+[smhd]$/),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('untimeout'),
    reason: z.string().optional(),
  }),
]);

export const warnSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(1),
});

export const warnThresholdSchema = z.object({
  warns: z.number().int().min(1),
  action: z.enum(['mute', 'kick', 'ban']),
  duration: z.string().regex(/^\d+[smhd]$/).optional(),
});

export const warnThresholdsSchema = z.array(warnThresholdSchema);

// Giveaway validators
export const createGiveawaySchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().min(1).max(4096),
  channelId: z.string().min(1),
  maxWinners: z.coerce.number().int().min(1).max(100),
  requiredRoleId: z.string().optional(),
  format: z.enum(['reaction', 'list']).default('reaction'),
  availableItems: z.array(z.string()).optional(),
  minChoices: z.coerce.number().int().min(1).optional(),
  maxChoices: z.coerce.number().int().min(1).optional(),
  endsAt: z.coerce.date(),
  startsAt: z.coerce.date().optional(),
});

export const giveawayEntrySchema = z.object({
  giveawayId: z.string().min(1),
  userId: z.string().min(1),
  choices: z.array(z.string()).optional(),
});

export const economyTransferSchema = z.object({
  toUserId: z.string().min(1),
  amount: z.coerce.bigint().gt(0n),
  guildId: z.string().min(1).optional(),
  reason: z.string().min(1).max(200).optional(),
});

export const economyAdminAdjustSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.bigint().gt(0n),
  guildId: z.string().min(1).optional(),
  reason: z.string().min(1).max(200).optional(),
});

export const coinflipCreateBetSchema = z.object({
  opponentId: z.string().min(1),
  betAmount: z.coerce.bigint().gt(0n),
  challengerSide: z.enum(['heads', 'tails']),
  guildId: z.string().min(1).optional(),
});

export const coinflipActionSchema = z.object({
  gameId: z.string().min(1),
});

// Config validators
export const autoModConfigSchema = z.object({
  modLogChannelId: z.string().nullable().optional(),
  announcementChannelId: z.string().nullable().optional(),
  giveawayChannelId: z.string().nullable().optional(),
  welcomeChannelId: z.string().nullable().optional(),
  leaveChannelId: z.string().nullable().optional(),

  welcomeMessage: z.string().nullable().optional(),
  leaveMessage: z.string().nullable().optional(),
  modLogMessage: z.string().nullable().optional(),

  muteRoleId: z.string().nullable().optional(),

  wordFilterEnabled: z.boolean().optional(),
  bannedWords: z.array(z.object({
    word: z.string(),
    action: z.enum(['warn', 'mute', 'kick', 'ban', 'delete']),
  })).optional(),
  wordFilterWhitelistChannels: z.array(z.string()).optional(),
  wordFilterWhitelistRoles: z.array(z.string()).optional(),

  capsEnabled: z.boolean().optional(),
  capsThreshold: z.number().min(0).max(100).optional(),
  capsMinLength: z.number().min(1).optional(),
  capsAction: z.enum(['warn', 'mute', 'kick', 'ban', 'delete']).optional(),
  capsWhitelistChannels: z.array(z.string()).optional(),
  capsWhitelistRoles: z.array(z.string()).optional(),

  linkFilterEnabled: z.boolean().optional(),
  linkBlockAll: z.boolean().optional(),
  bannedDomains: z.array(z.string()).optional(),
  allowedDomains: z.array(z.string()).optional(),
  linkAction: z.enum(['warn', 'mute', 'kick', 'ban', 'delete']).optional(),
  linkWhitelistChannels: z.array(z.string()).optional(),
  linkWhitelistRoles: z.array(z.string()).optional(),

  warnThresholds: warnThresholdsSchema.optional(),
  warnExpiration: z.number().int().min(1).optional(),

  prefix: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
});

export const guildWelcomeConfigSchema = z.object({
  welcomeChannelId: z.string().nullable().optional(),
  leaveChannelId: z.string().nullable().optional(),

  welcomeMessage: z.string().nullable().optional(),
  leaveMessage: z.string().nullable().optional(),
})

export const guildSettingsConfigSchema = z.object({
  prefix: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
})

export const guildModlogConfigSchema = z.object({
  modLogChannelId: z.string().nullable().optional(),
  modLogMessage: z.string().nullable().optional(),
})

export const guildAnnouncementConfigSchema = z.object({
  announcementChannelId: z.string().nullable().optional(),
})

export const guildGiveawayConfigSchema = z.object({
  giveawayChannelId: z.string().nullable().optional(),
})

export const guildAutomodConfigSchema = z.object({
  muteRoleId: z.string().nullable().optional(),

  wordFilterEnabled: z.boolean().optional(),
  bannedWords: z
    .array(
      z.object({
        word: z.string(),
        action: z.enum(['warn', 'mute', 'kick', 'ban', 'delete']),
      })
    )
    .optional(),
  wordFilterWhitelistChannels: z.array(z.string()).optional(),
  wordFilterWhitelistRoles: z.array(z.string()).optional(),

  capsEnabled: z.boolean().optional(),
  capsThreshold: z.number().min(0).max(100).optional(),
  capsMinLength: z.number().min(1).optional(),
  capsAction: z.enum(['warn', 'mute', 'kick', 'ban', 'delete']).optional(),
  capsWhitelistChannels: z.array(z.string()).optional(),
  capsWhitelistRoles: z.array(z.string()).optional(),

  linkFilterEnabled: z.boolean().optional(),
  linkBlockAll: z.boolean().optional(),
  bannedDomains: z.array(z.string()).optional(),
  allowedDomains: z.array(z.string()).optional(),
  linkAction: z.enum(['warn', 'mute', 'kick', 'ban', 'delete']).optional(),
  linkWhitelistChannels: z.array(z.string()).optional(),
  linkWhitelistRoles: z.array(z.string()).optional(),

  warnThresholds: warnThresholdsSchema.optional(),
  warnExpiration: z.number().int().min(1).optional(),
})

export const guildCommandOverrideSchema = z.object({
  commandType: z.enum(['slash', 'context']),
  commandName: z.string().min(1),
  enabled: z.boolean(),
})

export const guildCommandOverridesUpsertSchema = z.object({
  overrides: z.array(guildCommandOverrideSchema).min(1),
})

export const xpRoleRewardSchema = z.object({
  level: z.number().int().min(0),
  roleId: z.string().min(1),
});

export const xpRoleRewardsSchema = z.array(xpRoleRewardSchema);

export const guildXpConfigSchema = z.object({
  enabled: z.boolean().optional(),

  minMessageLength: z.number().int().min(0).optional(),
  minUniqueLength: z.number().int().min(0).optional(),
  typingCps: z.number().int().min(1).optional(),
  xpDivisorMin: z.number().int().min(1).optional(),
  xpDivisorMax: z.number().int().min(1).optional(),
  xpCap: z.number().int().min(1).optional(),

  ignoredChannelIds: z.array(z.string()).optional(),
  ignoredRoleIds: z.array(z.string()).optional(),
  roleXpMultipliers: z.record(z.string(), z.number().min(0)).optional(),

  rewardMode: z.enum(['stack', 'highest']).optional(),

  levelUpChannelId: z.string().nullable().optional(),
  levelUpMessage: z.string().nullable().optional(),

  rewards: xpRoleRewardsSchema.optional(),
});

export const guildAutoroleConfigSchema = z.object({
  enabled: z.boolean().optional(),

  delaySeconds: z.number().int().min(0).max(7 * 24 * 60 * 60).optional(),
  onlyAfterFirstMessage: z.boolean().optional(),

  roleIds: z.array(z.string().min(1)).max(20).optional(),
});

export const ticketConfigSchema = z.object({
  enabled: z.boolean().optional(),

  categoryId: z.string().nullable().optional(),
  logChannelId: z.string().nullable().optional(),

  supportRoleIds: z.array(z.string().min(1)).max(20).optional(),
});

export const ticketPanelPublishSchema = z.object({
  channelId: z.string().min(1),
});

export const suggestionConfigSchema = z.object({
  enabled: z.boolean().optional(),

  channelId: z.string().nullable().optional(),
  logChannelId: z.string().nullable().optional(),
});

export const reactionRoleItemSchema = z.object({
  roleId: z.string().min(1),
  label: z.string().min(1).max(80).nullable().optional(),
  emoji: z.string().min(1).max(64).nullable().optional(),
});

export const reactionRolePanelUpsertSchema = z.object({
  name: z.string().min(1).max(64),
  enabled: z.boolean().optional(),
  mode: z.enum(['single', 'multiple']).optional(),
  items: z.array(reactionRoleItemSchema).min(1).max(25),
});

export const reactionRolePanelPublishSchema = z.object({
  channelId: z.string().min(1),
});

export const starboardConfigSchema = z.object({
  enabled: z.boolean().optional(),
  channelId: z.string().nullable().optional(),
  emoji: z.string().min(1).max(64).optional(),
  threshold: z.number().int().min(1).max(50).optional(),
  ignoreBots: z.boolean().optional(),
});

export const xpResetSchema = z.object({
  scope: z.enum(['guild', 'user']).default('guild'),
  userId: z.string().min(1).optional(),
});

export const globalXpResetSchema = z.object({
  scope: z.enum(['global', 'user']).default('global'),
  userId: z.string().min(1).optional(),
});

// Pagination validator
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(50),
});

// Profile/Badges
export const profileUpdateSchema = z.object({
  bio: z.string().max(300).nullable().optional(),
});

export const badgeUpsertSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  description: z.string().max(256).nullable().optional(),
  category: z.string().min(1).max(32),
  icon: z.string().max(256).nullable().optional(),
  hidden: z.boolean().optional(),
});

export const userBadgeGrantSchema = z.object({
  userId: z.string().min(1),
  badgeId: z.string().min(1).max(64),
  source: z.string().min(1).max(32).default('manual'),
  expiresAt: z.coerce.date().nullable().optional(),
  metadata: z
    .unknown()
    .refine((value) => {
      const is_json_value = (v: unknown): boolean => {
        if (v === null) return true
        const t = typeof v
        if (t === 'string' || t === 'number' || t === 'boolean') return true
        if (Array.isArray(v)) return v.every(is_json_value)
        if (t === 'object') return Object.values(v as Record<string, unknown>).every(is_json_value)
        return false
      }

      return value === undefined || is_json_value(value)
    }, 'metadata must be a valid JSON value')
    .nullable()
    .optional(),
});

export const userBadgeRevokeSchema = z.object({
  userId: z.string().min(1),
  badgeId: z.string().min(1).max(64),
});

// Fan arts
export const fanArtStatusSchema = z.enum(['pending', 'approved', 'rejected'])

export const fanArtSubmitSchema = z.object({
  imageUrl: z.string().url().min(1),
  imageName: z.string().max(256).nullable().optional(),
  imageSize: z.number().int().min(0).nullable().optional(),

  title: z.string().max(128).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(32)).max(20).optional(),

  sourceChannelId: z.string().min(1).nullable().optional(),
  sourceMessageId: z.string().min(1).nullable().optional(),
})

export const fanArtReviewSchema = z.object({
  status: fanArtStatusSchema,
  reviewNote: z.string().max(2000).nullable().optional(),
})

// Export types inferred from schemas
export type BanInput = z.infer<typeof banSchema>;
export type KickInput = z.infer<typeof kickSchema>;
export type MuteInput = z.infer<typeof muteSchema>;
export type WarnInput = z.infer<typeof warnSchema>;
export type WarnThreshold = z.infer<typeof warnThresholdSchema>;
export type CreateGiveawayInput = z.infer<typeof createGiveawaySchema>;
export type GiveawayEntryInput = z.infer<typeof giveawayEntrySchema>;
export type EconomyTransferInput = z.infer<typeof economyTransferSchema>;
export type EconomyAdminAdjustInput = z.infer<typeof economyAdminAdjustSchema>;
export type CoinflipCreateBetInput = z.infer<typeof coinflipCreateBetSchema>;
export type CoinflipActionInput = z.infer<typeof coinflipActionSchema>;
export type AutoModConfigInput = z.infer<typeof autoModConfigSchema>;
export type GuildXpConfigInput = z.infer<typeof guildXpConfigSchema>;
export type GuildAutoroleConfigInput = z.infer<typeof guildAutoroleConfigSchema>;
export type TicketConfigInput = z.infer<typeof ticketConfigSchema>;
export type TicketPanelPublishInput = z.infer<typeof ticketPanelPublishSchema>;
export type SuggestionConfigInput = z.infer<typeof suggestionConfigSchema>;
export type ReactionRoleItemInput = z.infer<typeof reactionRoleItemSchema>;
export type ReactionRolePanelUpsertInput = z.infer<typeof reactionRolePanelUpsertSchema>;
export type ReactionRolePanelPublishInput = z.infer<typeof reactionRolePanelPublishSchema>;
export type StarboardConfigInput = z.infer<typeof starboardConfigSchema>;
export type XpRoleRewardInput = z.infer<typeof xpRoleRewardSchema>;
export type XpResetInput = z.infer<typeof xpResetSchema>;
export type GlobalXpResetInput = z.infer<typeof globalXpResetSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type BadgeUpsertInput = z.infer<typeof badgeUpsertSchema>;
export type UserBadgeGrantInput = z.infer<typeof userBadgeGrantSchema>;
export type UserBadgeRevokeInput = z.infer<typeof userBadgeRevokeSchema>;

export type FanArtStatus = z.infer<typeof fanArtStatusSchema>
export type FanArtSubmitInput = z.infer<typeof fanArtSubmitSchema>
export type FanArtReviewInput = z.infer<typeof fanArtReviewSchema>
