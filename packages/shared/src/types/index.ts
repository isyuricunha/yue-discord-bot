// Common types shared across the monorepo

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
}

export interface Guild {
  id: string;
  name: string;
  icon?: string;
  ownerId: string;
}

export type ModerationAction = 'ban' | 'kick' | 'warn' | 'mute' | 'unmute' | 'timeout';

export type AutoModAction = 'warn' | 'mute' | 'kick' | 'ban' | 'delete';

export interface ModLogEntry {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  action: ModerationAction;
  reason?: string;
  duration?: string;
  createdAt: Date;
}

export type GiveawayFormat = 'reaction' | 'list';

export type GiveawayStatus = 'pending' | 'active' | 'ended' | 'cancelled';

export interface GiveawayData {
  id: string;
  guildId: string;
  title: string;
  description: string;
  channelId: string;
  messageId?: string;
  format: GiveawayFormat;
  maxWinners: number;
  requiredRoleId?: string;
  endsAt: Date;
  status: GiveawayStatus;
}

export interface GiveawayEntryData {
  userId: string;
  username: string;
  avatar?: string;
  choices?: string[];
}

export interface GiveawayWinnerData {
  userId: string;
  username: string;
  prize?: string;
  prizeIndex?: number;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface JWTPayload {
  userId: string;
  username: string;
  discriminator: string;
  avatar?: string;
  guilds: string[]; // Guild IDs where user is admin
}

export interface AuthSession {
  token: string;
  expiresAt: Date;
  user: JWTPayload;
}
