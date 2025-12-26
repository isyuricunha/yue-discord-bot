import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { CONFIG } from './config';
import { logger } from './utils/logger';
import { prisma } from '@yuebot/database';
import { GiveawayScheduler } from './services/giveawayScheduler';
import { WarnExpirationService } from './services/warnExpirationService';
import { AutoroleScheduler } from './services/autoroleScheduler';
import type { Command, ContextMenuCommand } from './commands';
import { start_internal_api } from './internal/api';

let internal_server: ReturnType<typeof start_internal_api> | null = null;

// Extend Client to include commands collection
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
    contextMenuCommands: Collection<string, ContextMenuCommand>;
  }
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ],
});

// Initialize commands collection
client.commands = new Collection<string, Command>();
client.contextMenuCommands = new Collection<string, ContextMenuCommand>();

async function sync_guilds_to_database(discord_client: Client) {
  const guilds = Array.from(discord_client.guilds.cache.values());

  logger.info(`🔄 Sincronizando ${guilds.length} guild(s) no banco de dados...`);

  for (const guild of guilds) {
    try {
      await prisma.guild.upsert({
        where: { id: guild.id },
        update: {
          name: guild.name,
          icon: guild.icon,
          ownerId: guild.ownerId,
        },
        create: {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          ownerId: guild.ownerId,
        },
      });
    } catch (error) {
      logger.error({ error, guildId: guild.id }, '❌ Erro ao sincronizar guild no banco');
    }
  }

  logger.info('✅ Sincronização de guilds concluída');
}

// Event: Bot ready
client.once('ready', async () => {
  logger.info(`🤖 Bot conectado como ${client.user?.tag}`);
  logger.info(`📊 Servidores: ${client.guilds.cache.size}`);
  logger.info(`👥 Usuários: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`);

  await sync_guilds_to_database(client);

  internal_server = start_internal_api(client, {
    host: CONFIG.internalApi.host,
    port: CONFIG.internalApi.port,
    secret: CONFIG.internalApi.secret,
  });
  
  // Load commands
  const { loadCommands } = await import('./commands');
  await loadCommands(client);
  logger.info(`✅ ${client.commands.size} comandos carregados`);

  const { loadContextMenuCommands } = await import('./commands');
  await loadContextMenuCommands(client);
  logger.info(`✅ ${client.contextMenuCommands.size} context menu comando(s) carregado(s)`);
  
  // Iniciar scheduler de sorteios
  const giveawayScheduler = new GiveawayScheduler(client);
  giveawayScheduler.start();
  
  // Iniciar serviço de expiração de warns
  const warnExpirationService = new WarnExpirationService(client);
  warnExpirationService.start();

  // Iniciar scheduler de autorole
  const autoroleScheduler = new AutoroleScheduler(client);
  autoroleScheduler.start();
});

// Event: Guild create (bot joins server)
client.on('guildCreate', async (guild) => {
  logger.info(`➕ Bot adicionado ao servidor: ${guild.name} (${guild.id})`);
  
  try {
    // Create guild entry in database
    await prisma.guild.upsert({
      where: { id: guild.id },
      update: {
        name: guild.name,
        icon: guild.icon,
        ownerId: guild.ownerId,
      },
      create: {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        ownerId: guild.ownerId,
      },
    });
    
    logger.info(`✅ Servidor ${guild.name} registrado no banco de dados`);
  } catch (error) {
    logger.error({ error }, `❌ Erro ao registrar servidor ${guild.name}`);
  }
});

// Event: Guild delete (bot leaves server)
client.on('guildDelete', (guild) => {
  logger.info(`➖ Bot removido do servidor: ${guild.name} (${guild.id})`);
});

// Event: Interaction create (slash commands)
client.on('interactionCreate', async (interaction) => {
  const { handleInteractionCreate } = await import('./events/interactionCreate');
  await handleInteractionCreate(interaction);
});

// Event: Message create (AutoMod)
client.on('messageCreate', async (message) => {
  const { handleMessageCreate } = await import('./events/messageCreate');
  await handleMessageCreate(message);
});

// Event: Guild member add (Autorole)
client.on('guildMemberAdd', async (member) => {
  const { handleGuildMemberAdd } = await import('./events/guildMemberAdd');
  await handleGuildMemberAdd(member);
});

// Event: Guild member remove (Leave message)
client.on('guildMemberRemove', async (member) => {
  const { handleGuildMemberRemove } = await import('./events/guildMemberRemove');
  await handleGuildMemberRemove(member.guild, member.user);
});

// Event: Message reaction add (Giveaways)
client.on('messageReactionAdd', async (reaction, user) => {
  const { execute } = await import('./events/messageReactionAdd');
  await execute(reaction, user);
});

// Event: Message reaction remove (Giveaways)
client.on('messageReactionRemove', async (reaction, user) => {
  const { execute } = await import('./events/messageReactionRemove');
  await execute(reaction, user);
});

// Error handling
client.on('error', (error) => {
  logger.error({ error }, '❌ Erro no cliente Discord');
});

process.on('unhandledRejection', (error) => {
  logger.error({ error }, '❌ Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, '❌ Uncaught exception');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Desligando bot...');
  internal_server?.close();
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Desligando bot...');
  internal_server?.close();
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

// Login
logger.info('🔑 Tentando login no Discord...');
client.login(CONFIG.discord.token).catch((error) => {
  logger.error('❌ Falha ao fazer login no Discord');
  logger.error({ error }, 'Erro ao fazer login no Discord');
  process.exit(1);
});

export { client };
