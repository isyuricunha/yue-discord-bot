// Pure decision helpers for the HoneyPot trap channel. Keep this file free of
// prisma and discord.js structures (only the permission bitfield constants)
// so every rule stays unit-testable.
import { PermissionFlagsBits } from 'discord.js';

export const HONEYPOT_DELETE_MESSAGE_SECONDS = 600;
export const HONEYPOT_UNBAN_BUTTON_PREFIX = 'honeypot_unban:';
export const HONEYPOT_RECENT_PUNISH_TTL_MS = 60_000;

export interface honeypot_message_input {
  config_channel_id: string | null | undefined;
  channel_id: string | null | undefined;
  author_id: string;
  client_user_id: string | null | undefined;
  is_webhook: boolean;
  has_staff_permission: boolean;
}

export function should_catch_honeypot_message(input: honeypot_message_input): boolean {
  if (!input.config_channel_id) return false;
  if (input.config_channel_id !== input.channel_id) return false;
  if (input.is_webhook) return false;
  if (!input.author_id) return false;
  if (input.client_user_id && input.author_id === input.client_user_id) return false;
  if (input.has_staff_permission) return false;
  return true;
}

// Members holding BanMembers, ModerateMembers or ManageGuild are trusted not
// to fall into the trap by accident; compromised spam accounts never hold them.
export function has_staff_permission(permissions: { has(flag: bigint): boolean } | null | undefined): boolean {
  if (!permissions) return false;
  return (
    permissions.has(PermissionFlagsBits.BanMembers) ||
    permissions.has(PermissionFlagsBits.ModerateMembers) ||
    permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

// Unban is a higher-privilege action than the trap exemption: require
// BanMembers specifically (least privilege for reverting automated bans).
export function has_ban_permission(permissions: { has(flag: bigint): boolean } | null | undefined): boolean {
  if (!permissions) return false;
  return permissions.has(PermissionFlagsBits.BanMembers);
}

// Truncate by Unicode code points so the result never splits a surrogate
// pair (a plain UTF-16 slice can produce a lone surrogate that the Discord
// API rejects, silently dropping the whole log embed).
export function truncate_code_points(text: string, max_code_points: number): string {
  const chars = Array.from(text);
  if (chars.length <= max_code_points) return text;
  return chars.slice(0, max_code_points).join('');
}

export function honeypot_unban_target(custom_id: string): string | null {
  if (!custom_id.startsWith(HONEYPOT_UNBAN_BUTTON_PREFIX)) return null;
  const user_id = custom_id.slice(HONEYPOT_UNBAN_BUTTON_PREFIX.length);
  return /^\d{5,25}$/.test(user_id) ? user_id : null;
}
