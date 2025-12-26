import { Collection, SlashCommandBuilder } from 'discord.js';
import type {
  ChatInputCommandInteraction,
  Client,
  MessageContextMenuCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';

type command_data =
  | SlashCommandBuilder
  | {
      name: string;
      toJSON: () => RESTPostAPIApplicationCommandsJSONBody;
    };

export interface Command {
  data: command_data;
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
}

type context_menu_command_data = {
  name: string;
  toJSON: () => RESTPostAPIApplicationCommandsJSONBody;
};

export interface ContextMenuCommand {
  data: context_menu_command_data;
  execute: (interaction: MessageContextMenuCommandInteraction) => Promise<unknown>;
}

export async function loadCommands(client: Client): Promise<void> {
  const commands = new Collection<string, Command>();
  
  // Import moderation commands
  const { banCommand } = await import('./moderation/ban');
  const { kickCommand } = await import('./moderation/kick');
  const { muteCommand } = await import('./moderation/mute');
  const { unmuteCommand } = await import('./moderation/unmute');
  const { warnCommand } = await import('./moderation/warn');
  const { unwarnCommand } = await import('./moderation/unwarn');
  const { modlogCommand } = await import('./moderation/modlog');
  const { baninfoCommand } = await import('./moderation/baninfo');
  
  // Import utility commands
  const { limparCommand } = await import('./utility/limpar');
  const { lockCommand } = await import('./utility/lock');
  const { unlockCommand } = await import('./utility/unlock');
  const { painelCommand } = await import('./utility/painel');
  const { sayCommand } = await import('./utility/say');
  
  // Import giveaway commands
  const giveawayCommand = await import('./giveaway');
  const giveawayListaCommand = await import('./sorteio-lista');
  const giveawayWizardCommand = await import('./sorteio-wizard');

  // Import XP commands
  const { rankCommand } = await import('./xp/rank');
  const { leaderboardCommand } = await import('./xp/leaderboard');

  // Import profile commands
  const { profileCommand } = await import('./profile/profile');
  const { badgesCommand } = await import('./profile/badges');

  // Import fan art commands
  const fanartCommand = await import('./fanart')

  // Authenticated message commands
  const { verifyMessageCommand } = await import('./authenticated/verify_message');

  // Economy commands
  const { luazinhasCommand } = await import('./luazinhas');

  // Coinflip commands
  const { coinflipCommand } = await import('./coinflip');
  
  // Register commands
  commands.set(banCommand.data.name, banCommand);
  commands.set(kickCommand.data.name, kickCommand);
  commands.set(muteCommand.data.name, muteCommand);
  commands.set(unmuteCommand.data.name, unmuteCommand);
  commands.set(warnCommand.data.name, warnCommand);
  commands.set(unwarnCommand.data.name, unwarnCommand);
  commands.set(modlogCommand.data.name, modlogCommand);
  commands.set(baninfoCommand.data.name, baninfoCommand);
  commands.set(limparCommand.data.name, limparCommand);
  commands.set(lockCommand.data.name, lockCommand);
  commands.set(unlockCommand.data.name, unlockCommand);
  commands.set(painelCommand.data.name, painelCommand);
  commands.set(sayCommand.data.name, sayCommand);
  commands.set(giveawayCommand.data.name, { data: giveawayCommand.data, execute: giveawayCommand.execute });
  commands.set(giveawayListaCommand.data.name, { data: giveawayListaCommand.data, execute: giveawayListaCommand.execute });
  commands.set(giveawayWizardCommand.data.name, { data: giveawayWizardCommand.data, execute: giveawayWizardCommand.execute });
  commands.set(rankCommand.data.name, rankCommand);
  commands.set(leaderboardCommand.data.name, leaderboardCommand);
  commands.set(profileCommand.data.name, profileCommand);
  commands.set(badgesCommand.data.name, badgesCommand);
  commands.set(fanartCommand.data.name, { data: fanartCommand.data, execute: fanartCommand.execute });
  commands.set(verifyMessageCommand.data.name, verifyMessageCommand);
  commands.set(luazinhasCommand.data.name, luazinhasCommand);
  commands.set(coinflipCommand.data.name, coinflipCommand);
  
  client.commands = commands;
}

export async function loadContextMenuCommands(client: Client): Promise<void> {
  const commands = new Collection<string, ContextMenuCommand>();

  const { saveMessageHereCommand } = await import('./authenticated/save_message_here');
  const { saveMessageDmCommand } = await import('./authenticated/save_message_dm');

  commands.set(saveMessageHereCommand.data.name, saveMessageHereCommand);
  commands.set(saveMessageDmCommand.data.name, saveMessageDmCommand);

  client.contextMenuCommands = commands;
}
