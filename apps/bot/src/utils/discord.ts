import type { TextBasedChannelFields } from 'discord.js';

type sendable_channel = TextBasedChannelFields<boolean, boolean> & { id: string };

export function getSendableChannel(channel: unknown): sendable_channel | null {
  if (!channel || typeof channel !== 'object') return null;

  const candidate = channel as { send?: unknown };
  if (typeof candidate.send !== 'function') return null;

  return channel as sendable_channel;
}
