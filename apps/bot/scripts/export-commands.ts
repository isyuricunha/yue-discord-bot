// Exporta o catálogo real de comandos (slash + context menu) para a
// documentação pública do painel (apps/web/src/data/commands.generated.json).
//
// Uso: pnpm --filter @yuebot/bot exec tsx scripts/export-commands.ts
//
// Usa um client falso: o loadCommands só preenche client.commands, então nada
// do Discord é tocado. A fonte é sempre o SlashCommandBuilder real, assim a
// doc nunca destoa do bot.

import { Collection, Client } from 'discord.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const output_path = resolve(here, '../../web/src/data/commands.generated.json');

async function main(): Promise<void> {
  const { loadCommands, loadContextMenuCommands } = await import('../src/commands');

  const client = new Client({ intents: [] });
  client.commands = new Collection();
  client.contextMenuCommands = new Collection();

  await loadCommands(client);
  await loadContextMenuCommands(client);

  const to_doc = (data: { toJSON: () => Record<string, unknown> }) => data.toJSON();

  const payload = {
    generatedAt: new Date().toISOString(),
    commands: [...client.commands.values()].map((command) => to_doc(command.data)),
    contextMenu: [...client.contextMenuCommands.values()].map((command) => to_doc(command.data)),
  };

  mkdirSync(dirname(output_path), { recursive: true });
  writeFileSync(output_path, JSON.stringify(payload, null, 2) + '\n');

  console.log(
    `exportados ${payload.commands.length} comandos e ${payload.contextMenu.length} context menus para ${output_path}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
