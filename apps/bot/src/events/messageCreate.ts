import type { Message } from 'discord.js';
import { autoModService } from '../services/automod.service';
import { autoroleService } from '../services/autorole.service';
import { suggestionService } from '../services/suggestion.service';
import { xpService } from '../services/xp.service';
import { logger } from '../utils/logger';

export async function handleMessageCreate(message: Message) {
  // Ignorar mensagens de bots e DMs
  if (message.author.bot || !message.guild) return;

  try {
    await autoroleService.handle_message(message);

    const handled_by_suggestions = await suggestionService.handle_message(message)
    if (handled_by_suggestions) return

    // Verificar AutoMod
    const deleted_by_automod = await autoModService.checkMessage(message);
    if (deleted_by_automod) return;

    await xpService.handle_message(message);
  } catch (error) {
    logger.error({ error }, 'Erro ao processar mensagem');
  }
}
