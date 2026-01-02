import type { Interaction } from 'discord.js';
import { logger } from '../utils/logger';
import { EMOJIS } from '@yuebot/shared';
import { safe_error_details } from '../utils/safe_error'

export async function handleInteractionCreate(interaction: Interaction) {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Comando não encontrado: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error({ err: safe_error_details(error), command: interaction.commandName }, 'Erro ao executar comando');

      const errorMessage = {
        content: `${EMOJIS.ERROR} Ocorreu um erro ao executar este comando!`,
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }

  // Handle message context menu commands
  if (interaction.isMessageContextMenuCommand()) {
    const command = interaction.client.contextMenuCommands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Context menu comando não encontrado: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error({ err: safe_error_details(error), command: interaction.commandName }, 'Erro ao executar context menu comando');

      const errorMessage = {
        content: `${EMOJIS.ERROR} Ocorreu um erro ao executar este comando!`,
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }

  // Handle buttons
  if (interaction.isButton()) {
    if (interaction.customId === 'giveaway_participate') {
      const { handleGiveawayParticipate } = await import('../handlers/giveawayHandlers');
      await handleGiveawayParticipate(interaction);
    } else if (interaction.customId.startsWith('rr:')) {
      const { reactionRoleService } = await import('../services/reactionRole.service')
      await reactionRoleService.handle_button(interaction)
    } else if (interaction.customId.startsWith('suggestion:')) {
      const { suggestionService } = await import('../services/suggestion.service');
      await suggestionService.handle_button(interaction);
    } else if (interaction.customId === 'ticket:open') {
      const { ticketService } = await import('../services/ticket.service');
      await ticketService.handle_open(interaction);
    } else if (interaction.customId.startsWith('ticket:close:')) {
      const { ticketService } = await import('../services/ticket.service');
      await ticketService.handle_close_button(interaction);
    } else if (interaction.customId.startsWith('coinflip:')) {
      const { handleCoinflipButton } = await import('../handlers/coinflipHandlers');
      await handleCoinflipButton(interaction);
    } else if (interaction.customId.startsWith('waifu:')) {
      const { handleWaifuButton } = await import('../handlers/waifuHandlers');
      await handleWaifuButton(interaction);
    } else if (interaction.customId.startsWith('wizard_cancel_')) {
      const { handleCancel } = await import('../commands/sorteio-wizard');
      await handleCancel(interaction);
    } else if (interaction.customId.startsWith('wizard_skip_role_')) {
      const { handleFinish } = await import('../commands/sorteio-wizard');
      await handleFinish(interaction, true);
    }
  }

  // Handle select menus
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('giveaway_items_')) {
      const { handleGiveawayItemsSelect } = await import('../handlers/giveawayHandlers');
      await handleGiveawayItemsSelect(interaction);
    } else if (interaction.customId.startsWith('wizard_format_')) {
      const { handleFormatSelection } = await import('../commands/sorteio-wizard');
      await handleFormatSelection(interaction);
    }
  }

  // Handle channel select menus
  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId.startsWith('wizard_channel_')) {
      const { handleChannelSelection } = await import('../commands/sorteio-wizard');
      await handleChannelSelection(interaction);
    }
  }

  // Handle role select menus
  if (interaction.isRoleSelectMenu()) {
    if (interaction.customId.startsWith('wizard_role_')) {
      const { handleFinish } = await import('../commands/sorteio-wizard');
      await handleFinish(interaction, false);
    }
  }

  // Handle modals
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('giveaway_choices_')) {
      const { handleGiveawayChoicesModal } = await import('../handlers/giveawayHandlers');
      await handleGiveawayChoicesModal(interaction);
    } else if (interaction.customId.startsWith('ticket:close_reason:')) {
      const { ticketService } = await import('../services/ticket.service');
      await ticketService.handle_close_modal(interaction);
    } else if (interaction.customId.startsWith('suggestion:decision:')) {
      const { suggestionService } = await import('../services/suggestion.service');
      await suggestionService.handle_decision_modal(interaction);
    } else if (interaction.customId.startsWith('wizard_basic_')) {
      const { handleBasicInfo } = await import('../commands/sorteio-wizard');
      await handleBasicInfo(interaction);
    } else if (interaction.customId.startsWith('wizard_items_')) {
      const { handleItems } = await import('../commands/sorteio-wizard');
      await handleItems(interaction);
    }
  }
}
