import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';
import { logger } from '../../utils/logger';

// Constants for Pet system limits
const PET_DEGRADE_PER_HOUR = 5; 
const PET_ACTION_COOLDOWN_MS = 1000 * 60 * 30; // 30 minutes

function get_pet_mood(happiness: number, hunger: number, energy: number) {
  if (happiness > 80 && hunger > 80 && energy > 80) return 'Feliz 😄';
  if (hunger < 30) return 'Faminto 🍔';
  if (energy < 30) return 'Exausto 😴';
  if (happiness < 30) return 'Triste 😢';
  return 'Neutro 😐';
}

function calculate_degradation(lastInteraction: Date) {
  const hoursPassed = (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60);
  const degradation = Math.floor(hoursPassed * PET_DEGRADE_PER_HOUR);
  return degradation > 0 ? degradation : 0;
}

export const petCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('pet')
    .setNameLocalizations({ 'pt-BR': 'pet' })
    .setDescription('Cuide do seu bichinho virtual (Tamagotchi)')
    .setDescriptionLocalizations({ 'pt-BR': 'Cuide do seu bichinho virtual (Tamagotchi)' })
    .addSubcommand((subcommand) =>
      subcommand
        .setName('adotar')
        .setDescription('Adote um novo pet')
        .addStringOption((option) =>
          option
            .setName('especie')
            .setDescription('Escolha a espécie do seu pet')
            .setRequired(true)
            .addChoices(
              { name: 'Cachorro 🐶', value: 'Cachorro' },
              { name: 'Gato 🐱', value: 'Gato' },
              { name: 'Coelho 🐰', value: 'Coelho' },
              { name: 'Pinguim 🐧', value: 'Pinguim' },
              { name: 'Raposa 🦊', value: 'Raposa' }
            )
        )
        .addStringOption((option) =>
          option.setName('nome').setDescription('O nome do seu pet').setRequired(true).setMaxLength(32)
        )
    )
    .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Veja o status e atributos do seu pet'))
    .addSubcommand((subcommand) => subcommand.setName('alimentar').setDescription('Dê comida para o seu pet'))
    .addSubcommand((subcommand) => subcommand.setName('brincar').setDescription('Brinque para aumentar a felicidade'))
    .addSubcommand((subcommand) => subcommand.setName('dormir').setDescription('Coloque seu pet para dormir')),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'adotar') {
      const especie = interaction.options.getString('especie', true);
      const nome = interaction.options.getString('nome', true);

      // Check if user already has a pet
      const existingPet = await prisma.pet.findFirst({ where: { userId } });
      if (existingPet) {
        return interaction.reply({
          content: `${EMOJIS.ERROR} Você já adota o(a) **${existingPet.name}**! Cuide dele primeiro.`,
          ephemeral: true,
        });
      }

      await prisma.user.upsert({
         where: { id: userId },
         create: { id: userId, username: interaction.user.username },
         update: {}
      });

      const novoPet = await prisma.pet.create({
        data: {
          userId,
          name: nome,
          species: especie,
        },
      });

      return interaction.reply({
        content: `🎉 Parabéns! Você acabou de adotar um(a) **${especie}** chamado(a) **${novoPet.name}**!\nUse \`/pet status\` para vê-lo.`,
      });
    }

    // Fetch Pet for all other subcommands
    const currentPet = await prisma.pet.findFirst({ where: { userId } });

    if (!currentPet) {
      return interaction.reply({
        content: `${EMOJIS.ERROR} Você ainda não tem um Pet! Use \`/pet adotar\` para começar.`,
        ephemeral: true,
      });
    }

    // Apply temporal degradation before showing/acting
    const degradation = calculate_degradation(currentPet.lastInteractionAt);
    let petVars = { ...currentPet };

    if (degradation > 0) {
      petVars.hunger = Math.max(0, petVars.hunger - degradation);
      petVars.energy = Math.max(0, petVars.energy - degradation);
      petVars.happiness = Math.max(0, petVars.happiness - Math.floor(degradation / 2));
      
      const timeNow = new Date();
      petVars = await prisma.pet.update({
        where: { id: petVars.id },
        data: {
          hunger: petVars.hunger,
          energy: petVars.energy,
          happiness: petVars.happiness,
          lastInteractionAt: timeNow
        }
      });
    }

    const { hunger, energy, happiness, name, species, level } = petVars;

    if (subcommand === 'status') {
      const mood = get_pet_mood(happiness, hunger, energy);
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`🐾 Perfil de ${name} (${species})`)
        .setDescription(`Nível: **${level}** | Status: **${mood}**`)
        .addFields(
          { name: '🍔 Fome', value: `${hunger}/100`, inline: true },
          { name: '😴 Energia', value: `${energy}/100`, inline: true },
          { name: '😄 Felicidade', value: `${happiness}/100`, inline: true }
        )
        .setFooter({ text: 'Cuide bem dele interagindo com /pet alimentar, brincar ou dormir.' })
        .setThumbnail(interaction.user.displayAvatarURL());

      return interaction.reply({ embeds: [embed] });
    }

    // Interactive Actions (Feed, Play, Sleep) with random variation
    let updateData = { lastInteractionAt: new Date() } as any;
    let replyMessage = '';

    if (subcommand === 'alimentar') {
       if (hunger >= 100) return interaction.reply({ content: `🍔 **${name}** já está muito cheio!`, ephemeral: true });
       const gain = Math.floor(Math.random() * 20) + 15;
       updateData.hunger = Math.min(100, hunger + gain);
       updateData.xp = { increment: 5 };
       replyMessage = `🍔 Você alimentou **${name}**! (Fome +${gain}%)`;
    } 
    
    else if (subcommand === 'brincar') {
       if (happiness >= 100) return interaction.reply({ content: `⚽ **${name}** já está super feliz!`, ephemeral: true });
       if (energy <= 20) return interaction.reply({ content: `😴 **${name}** está muito cansado para brincar agora...`, ephemeral: true });
       
       const gain = Math.floor(Math.random() * 25) + 15;
       const energyCost = 15;
       updateData.happiness = Math.min(100, happiness + gain);
       updateData.energy = Math.max(0, energy - energyCost);
       updateData.xp = { increment: 10 };
       replyMessage = `⚽ Você brincou com **${name}**! (Felicidade +${gain}% | Energia -${energyCost}%)`;
    }

    else if (subcommand === 'dormir') {
       if (energy >= 100) return interaction.reply({ content: `💤 **${name}** não está com sono!`, ephemeral: true });
       const gain = Math.floor(Math.random() * 40) + 30;
       updateData.energy = Math.min(100, energy + gain);
       updateData.xp = { increment: 5 };
       replyMessage = `💤 **${name}** tirou uma boa soneca! (Energia +${gain}%)`;
    }

    try {
      await prisma.pet.update({
        where: { id: petVars.id },
        data: updateData
      });
      await interaction.reply({ content: replyMessage });
    } catch (e) {
      logger.error(e, 'Failed to interact with pet');
      await interaction.reply({ content: `${EMOJIS.ERROR} Erro ao interagir com seu pet.`, ephemeral: true });
    }

  },
};
