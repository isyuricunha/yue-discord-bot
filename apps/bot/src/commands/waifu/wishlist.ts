import { SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import type { Command } from '../index'

import { desejosCommand } from './desejos'

export const wishlistCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('wishlist')
    .setDescription('Alias de /desejos')
    .setDescriptionLocalizations({ 'pt-BR': 'Alias de /desejos' })
    .addSubcommand((sub) =>
      sub
        .setName('adicionar')
        .setNameLocalizations({ 'pt-BR': 'adicionar' })
        .setDescription('Adicionar um personagem na sua wishlist')
        .setDescriptionLocalizations({ 'pt-BR': 'Adicionar um personagem na sua wishlist' })
        .addStringOption((opt) =>
          opt
            .setName('nome')
            .setNameLocalizations({ 'pt-BR': 'nome' })
            .setDescription('Nome do personagem')
            .setDescriptionLocalizations({ 'pt-BR': 'Nome do personagem' })
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setNameLocalizations({ 'pt-BR': 'remover' })
        .setDescription('Remover um personagem da sua wishlist')
        .setDescriptionLocalizations({ 'pt-BR': 'Remover um personagem da sua wishlist' })
        .addStringOption((opt) =>
          opt
            .setName('nome')
            .setNameLocalizations({ 'pt-BR': 'nome' })
            .setDescription('Nome do personagem')
            .setDescriptionLocalizations({ 'pt-BR': 'Nome do personagem' })
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setNameLocalizations({ 'pt-BR': 'listar' })
        .setDescription('Ver wishlist de alguém')
        .setDescriptionLocalizations({ 'pt-BR': 'Ver wishlist de alguém' })
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setNameLocalizations({ 'pt-BR': 'usuario' })
            .setDescription('Usuário (padrão: você)')
            .setDescriptionLocalizations({ 'pt-BR': 'Usuário (padrão: você)' })
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('pagina')
            .setNameLocalizations({ 'pt-BR': 'pagina' })
            .setDescription('Página (padrão: 1)')
            .setDescriptionLocalizations({ 'pt-BR': 'Página (padrão: 1)' })
            .setRequired(false)
            .setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await desejosCommand.execute(interaction)
  },
}
