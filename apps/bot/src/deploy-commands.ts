import { REST, Routes, Collection } from 'discord.js';
import { assert_deploy_commands_env, CONFIG } from './config';
import { logger } from './utils/logger';
import type { Command, ContextMenuCommand } from './commands';

async function loadCommandsForDeploy(): Promise<Command[]> {
  const commands: Command[] = [];

  // Import moderation commands
  const { banCommand } = await import('./commands/moderation/ban');
  const { kickCommand } = await import('./commands/moderation/kick');
  const { muteCommand } = await import('./commands/moderation/mute');
  const { unmuteCommand } = await import('./commands/moderation/unmute');
  const { warnCommand } = await import('./commands/moderation/warn');
  const { unwarnCommand } = await import('./commands/moderation/unwarn');
  const { modlogCommand } = await import('./commands/moderation/modlog');
  const { baninfoCommand } = await import('./commands/moderation/baninfo');
  const { antiraidCommand } = await import('./commands/moderation/antiraid');

  // Import utility commands
  const { limparCommand } = await import('./commands/utility/limpar');
  const { lockCommand } = await import('./commands/utility/lock');
  const { unlockCommand } = await import('./commands/utility/unlock');
  const { painelCommand } = await import('./commands/utility/painel');
  const { sayCommand } = await import('./commands/utility/say');
  const { ticketCommand } = await import('./commands/utility/ticket');
  const { configCommand } = await import('./commands/utility/config');
  const { reportCommand } = await import('./commands/utility/report');
  const { reactionrolesCommand } = await import('./commands/utility/reactionroles');
  const { eventoCommand } = await import('./commands/utility/evento');
  const { petCommand } = await import('./commands/utility/pet');
  const { triviaCommand } = await import('./commands/utility/trivia');
  const { dailyCommand } = await import('./commands/utility/daily');
  const { pollCommand } = await import('./commands/utility/poll');
  const { afkCommand, volteiCommand } = await import('./commands/utility/afk');
  const { aniversarioCommand } = await import('./commands/utility/aniversario');

  // Import giveaway commands
  const giveawayCommand = await import('./commands/giveaway');
  const giveawayListaCommand = await import('./commands/sorteio-lista');
  const giveawayWizardCommand = await import('./commands/sorteio-wizard');

  // Import XP commands
  const { rankCommand } = await import('./commands/xp/rank');
  const { leaderboardCommand } = await import('./commands/xp/leaderboard');
  const { prestigeCommand } = await import('./commands/xp/prestige');
  const { levelUpCommand } = await import('./commands/xp/levelup');
  const { transferCommand } = await import('./commands/xp/transfer');

  // Import profile commands
  const { profileCommand } = await import('./commands/profile/profile');
  const { badgesCommand } = await import('./commands/profile/badges');

  // Import fan art commands
  const fanartCommand = await import('./commands/fanart');

  // Authenticated message commands
  const { verifyMessageCommand } = await import('./commands/authenticated/verify_message');

  // Anime commands
  const { animeCommand } = await import('./commands/anime');

  // Economy commands
  const { luazinhasCommand } = await import('./commands/luazinhas');
  const { lojaCommand } = await import('./commands/loja');
  const { inventarioCommand } = await import('./commands/inventario');
  const { bancoCommand } = await import('./commands/economy/banco');

  // Coinflip commands
  const { coinflipCommand } = await import('./commands/coinflip');

  // Waifu commands
  const { waifuCommand } = await import('./commands/waifu/waifu');
  const { husbandoCommand } = await import('./commands/waifu/husbando');
  const { casarCommand } = await import('./commands/waifu/casar');
  const { rerollCommand } = await import('./commands/waifu/reroll');
  const { meuharemCommand } = await import('./commands/waifu/meuharem');
  const { divorciarCommand } = await import('./commands/waifu/divorciar');
  const { infocasamentoCommand } = await import('./commands/waifu/infocasamento');
  const { desejosCommand } = await import('./commands/waifu/desejos');
  const { waifupontosCommand } = await import('./commands/waifu/waifupontos');
  const { wishlistCommand } = await import('./commands/waifu/wishlist');
  const { haremCommand } = await import('./commands/waifu/harem');
  const { marryCommand } = await import('./commands/waifu/marry');
  const { divorceCommand } = await import('./commands/waifu/divorce');
  const { rankingCommand } = await import('./commands/waifu/ranking');

  // Music commands
  const playCommand = (await import('./commands/music/play')).default;
  const skipCommand = (await import('./commands/music/skip')).default;
  const stopCommand = (await import('./commands/music/stop')).default;
  const volumeCommand = (await import('./commands/music/volume')).default;
  const queueCommand = (await import('./commands/music/queue')).default;
  const playlistCommand = (await import('./commands/music/playlist')).default;
  const nowplayingCommand = (await import('./commands/music/nowplaying')).default;
  const djCommand = (await import('./commands/music/dj')).default;

  // Add all commands
  commands.push(banCommand);
  commands.push(kickCommand);
  commands.push(muteCommand);
  commands.push(unmuteCommand);
  commands.push(warnCommand);
  commands.push(unwarnCommand);
  commands.push(modlogCommand);
  commands.push(baninfoCommand);
  commands.push(antiraidCommand);
  commands.push(limparCommand);
  commands.push(lockCommand);
  commands.push(unlockCommand);
  commands.push(painelCommand);
  commands.push(sayCommand);

  if (typeof process.env.GROQ_API_KEY === 'string' && process.env.GROQ_API_KEY.trim().length > 0) {
    const { askCommand } = await import('./commands/utility/ask');
    commands.push(askCommand);
  }

  commands.push(ticketCommand);
  commands.push(configCommand);
  commands.push(reportCommand);
  commands.push(reactionrolesCommand);
  commands.push(eventoCommand);
  commands.push(petCommand);
  commands.push(triviaCommand);
  commands.push(dailyCommand);
  commands.push(pollCommand);
  commands.push(afkCommand);
  commands.push(volteiCommand);
  commands.push(aniversarioCommand);
  commands.push({ data: giveawayCommand.data, execute: giveawayCommand.execute });
  commands.push({ data: giveawayListaCommand.data, execute: giveawayListaCommand.execute });
  commands.push({ data: giveawayWizardCommand.data, execute: giveawayWizardCommand.execute });
  commands.push(rankCommand);
  commands.push(leaderboardCommand);
  commands.push(transferCommand);
  commands.push(prestigeCommand);
  commands.push(levelUpCommand);
  commands.push(profileCommand);
  commands.push(badgesCommand);
  commands.push({ data: fanartCommand.data, execute: fanartCommand.execute });
  commands.push(verifyMessageCommand);
  commands.push(animeCommand);
  commands.push(luazinhasCommand);
  commands.push(lojaCommand);
  commands.push(inventarioCommand);
  commands.push(bancoCommand);
  commands.push(coinflipCommand);
  commands.push(waifuCommand);
  commands.push(husbandoCommand);
  commands.push(casarCommand);
  commands.push(rerollCommand);
  commands.push(meuharemCommand);
  commands.push(divorciarCommand);
  commands.push(infocasamentoCommand);
  commands.push(desejosCommand);
  commands.push(waifupontosCommand);
  commands.push(wishlistCommand);
  commands.push(haremCommand);
  commands.push(marryCommand);
  commands.push(divorceCommand);
  commands.push(rankingCommand);

  // Add music commands
  commands.push(playCommand);
  commands.push(skipCommand);
  commands.push(stopCommand);
  commands.push(volumeCommand);
  commands.push(queueCommand);
  commands.push(playlistCommand);
  commands.push(nowplayingCommand);
  commands.push(djCommand);

  return commands;
}

async function loadContextMenuCommandsForDeploy(): Promise<ContextMenuCommand[]> {
  const commands: ContextMenuCommand[] = [];

  const { saveMessageHereCommand } = await import('./commands/authenticated/save_message_here');
  const { saveMessageDmCommand } = await import('./commands/authenticated/save_message_dm');
  const { reportMessageCommand } = await import('./commands/utility/report_message');

  commands.push(saveMessageHereCommand);
  commands.push(saveMessageDmCommand);
  commands.push(reportMessageCommand);

  return commands;
}

export async function deployCommands() {
  try {
    assert_deploy_commands_env();
    logger.info('🚀 Iniciando deploy de comandos slash...');

    // Load commands directly without creating a Discord Client
    const commands = await loadCommandsForDeploy();
    const contextMenuCommands = await loadContextMenuCommandsForDeploy();

    // Convert commands to JSON
    const commandsJson = [
      ...commands.map((cmd) => cmd.data.toJSON()),
      ...contextMenuCommands.map((cmd) => cmd.data.toJSON()),
    ];

    logger.info(`📦 ${commandsJson.length} comandos para registrar`);

    // Construct and prepare an instance of the REST module
    const rest = new REST({ timeout: 15_000 }).setToken(CONFIG.discord.token);

    // Deploy commands globally
    const data = await rest.put(
      Routes.applicationCommands(CONFIG.discord.clientId),
      { body: commandsJson },
    );

    if (!Array.isArray(data)) {
      throw new Error('Resposta inesperada ao registrar comandos (esperado array)');
    }

    logger.info(`✅ ${data.length} comandos registrados globalmente com sucesso!`);

    // List registered commands
    commandsJson.forEach((cmd) => {
      logger.info(`  • ${cmd.name}`);
    });

    // Exit the process successfully after allowing event loop to flush
    // Using setTimeout to avoid Windows assertion error with async handles
    setTimeout(() => {
      process.exit(0);
    }, 100);

  } catch (error) {
    logger.error({ error }, '❌ Erro ao registrar comandos');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void deployCommands();
}
