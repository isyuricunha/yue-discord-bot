import { REST, Routes } from 'discord.js';
import { CONFIG } from './config';
import { logger } from './utils/logger';
import type { Command, ContextMenuCommand } from './commands';

export async function deployCommands() {
  try {
    logger.info('🚀 Iniciando deploy de comandos slash...');

    // Load commands
    const { loadCommands, loadContextMenuCommands } = await import('./commands');
    const { Client, Collection } = await import('discord.js');
    
    const tempClient = new Client({ intents: [] });
    tempClient.commands = new Collection<string, Command>();
    tempClient.contextMenuCommands = new Collection<string, ContextMenuCommand>();
    await loadCommands(tempClient);
    await loadContextMenuCommands(tempClient);

    // Convert commands to JSON
    const commands = [
      ...Array.from(tempClient.commands.values()).map((cmd) => cmd.data.toJSON()),
      ...Array.from(tempClient.contextMenuCommands.values()).map((cmd) => cmd.data.toJSON()),
    ];

    logger.info(`📦 ${commands.length} comandos para registrar`);

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(CONFIG.discord.token);

    // Deploy commands globally
    const data = await rest.put(
      Routes.applicationCommands(CONFIG.discord.clientId),
      { body: commands },
    );

    if (!Array.isArray(data)) {
      throw new Error('Resposta inesperada ao registrar comandos (esperado array)');
    }

    logger.info(`✅ ${data.length} comandos registrados globalmente com sucesso!`);
    
    // List registered commands
    commands.forEach((cmd) => {
      logger.info(`  • ${cmd.name}`);
    });

  } catch (error) {
    logger.error({ error }, '❌ Erro ao registrar comandos');
    process.exit(1);
  }
}

if (require.main === module) {
  void deployCommands();
}
