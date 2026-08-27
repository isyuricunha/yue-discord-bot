import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

type load_env_options = {
  maxParentLevels?: number;
};


export function parse_env_boolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

export function parse_env_csv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function parse_env_int(
  value: string | undefined,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number {
  if (value === undefined) return fallback
  const trimmed = value.trim()
  if (!/^-?\d+$/.test(trimmed)) return fallback
  const parsed = Number(trimmed)
  if (!Number.isSafeInteger(parsed)) return fallback
  if (options.min !== undefined && parsed < options.min) return fallback
  if (options.max !== undefined && parsed > options.max) return fallback
  return parsed
}

export function parse_env_positive_int(value: string | undefined, fallback: number, max: number): number {
  return parse_env_int(value, fallback, { min: 1, max })
}

export function parse_env_port(value: string | undefined, fallback: number): number {
  return parse_env_int(value, fallback, { min: 1, max: 65_535 })
}

export function apply_ai_prompt_path_aliases(env: NodeJS.ProcessEnv = process.env): void {
  const discordPromptPath = env.DISCORD_AI_SYSTEM_PROMPT_PATH?.trim();
  if (discordPromptPath) {
    env.MISTRAL_PROMPT_PATH = discordPromptPath;
  }

  const panelPromptPath = env.PANEL_AI_SYSTEM_PROMPT_PATH?.trim();
  if (panelPromptPath) {
    env.PANEL_AI_PROMPT_PATH = panelPromptPath;
  }
}

export function load_env(options: load_env_options = {}) {
  const maxParentLevels = options.maxParentLevels ?? 3;

  const candidates: string[] = [];
  for (let i = 0; i <= maxParentLevels; i += 1) {
    candidates.push(path.resolve(process.cwd(), '../'.repeat(i), '.env'));
  }

  const envPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (envPath) {
    config({ path: envPath, quiet: true });

    const envLocalPath = path.resolve(path.dirname(envPath), '.env.local');
    if (fs.existsSync(envLocalPath)) {
      config({ path: envLocalPath, override: true, quiet: true });
    }

    apply_ai_prompt_path_aliases();
    return { loaded: true as const, path: envPath };
  }

  config({ quiet: true });
  apply_ai_prompt_path_aliases();
  return { loaded: false as const, path: undefined };
}
