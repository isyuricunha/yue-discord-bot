import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

type load_env_options = {
  maxParentLevels?: number;
};

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
    config({ path: envPath });

    const envLocalPath = path.resolve(path.dirname(envPath), '.env.local');
    if (fs.existsSync(envLocalPath)) {
      config({ path: envLocalPath, override: true });
    }

    apply_ai_prompt_path_aliases();
    return { loaded: true as const, path: envPath };
  }

  config();
  apply_ai_prompt_path_aliases();
  return { loaded: false as const, path: undefined };
}
