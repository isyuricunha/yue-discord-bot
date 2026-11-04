// Pure decision helpers for the HoneyPot trap channel. Keep this file free of
// discord.js and prisma imports so every rule stays unit-testable.

export const HONEYPOT_DELETE_MESSAGE_SECONDS = 600;
export const HONEYPOT_UNBAN_BUTTON_PREFIX = 'honeypot_unban:';

export interface honeypot_message_input {
  config_channel_id: string | null | undefined;
  channel_id: string;
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

export function honeypot_unban_target(custom_id: string): string | null {
  if (!custom_id.startsWith(HONEYPOT_UNBAN_BUTTON_PREFIX)) return null;
  const user_id = custom_id.slice(HONEYPOT_UNBAN_BUTTON_PREFIX.length);
  return /^\d{5,25}$/.test(user_id) ? user_id : null;
}
