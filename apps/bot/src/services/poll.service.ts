import { Colors, EmbedBuilder } from 'discord.js';
import { prisma } from '@yuebot/database';

import { logger } from '../utils/logger';
import { safe_error_details } from '../utils/safe_error';

export type poll_option = {
  id: number;
  text: string;
  votes: number;
};

export type create_poll_data = {
  guildId: string;
  channelId: string;
  messageId: string;
  question: string;
  options: poll_option[];
  multiVote: boolean;
  endsAt: Date;
  createdBy: string;
};

export async function createPoll(data: create_poll_data) {
  const poll = await prisma.poll.create({
    data: {
      guildId: data.guildId,
      channelId: data.channelId,
      messageId: data.messageId,
      question: data.question,
      options: data.options,
      multiVote: data.multiVote,
      endsAt: data.endsAt,
      createdBy: data.createdBy,
    },
  });

  return poll;
}

export async function getPollByMessageId(messageId: string) {
  return prisma.poll.findUnique({
    where: { messageId },
    include: {
      votes: true,
    },
  });
}

export async function getPollById(pollId: string) {
  return prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      votes: true,
    },
  });
}

export async function vote(pollId: string, userId: string, optionIds: number[], multiVote: boolean) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
  });

  if (!poll) {
    throw new Error('Poll not found');
  }

  if (poll.ended) {
    throw new Error('Poll has ended');
  }

  if (new Date() > poll.endsAt) {
    throw new Error('Poll has expired');
  }

  const existingVote = await prisma.pollVote.findUnique({
    where: {
      pollId_userId: {
        pollId,
        userId,
      },
    },
  });

  if (existingVote && !multiVote) {
    throw new Error('User has already voted');
  }

  const options = poll.options as poll_option[];
  
  if (multiVote) {
    for (const optionId of optionIds) {
      const option = options.find(o => o.id === optionId);
      if (!option) {
        throw new Error(`Option ${optionId} not found`);
      }
    }

    if (existingVote) {
      const oldOptionIds = existingVote.optionIds as number[];
      const newOptionIds = optionIds;

      for (const oldId of oldOptionIds) {
        if (!newOptionIds.includes(oldId)) {
          const option = options.find(o => o.id === oldId);
          if (option) {
            option.votes = Math.max(0, option.votes - 1);
          }
        }
      }

      for (const newId of newOptionIds) {
        if (!oldOptionIds.includes(newId)) {
          const option = options.find(o => o.id === newId);
          if (option) {
            option.votes += 1;
          }
        }
      }

      await prisma.pollVote.update({
        where: { id: existingVote.id },
        data: {
          optionIds: newOptionIds,
        },
      });
    } else {
      for (const optionId of optionIds) {
        const option = options.find(o => o.id === optionId);
        if (option) {
          option.votes += 1;
        }
      }

      await prisma.pollVote.create({
        data: {
          pollId,
          userId,
          optionIds,
        },
      });
    }
  } else {
    if (existingVote) {
      const oldOptionId = (existingVote.optionIds as number[])[0];
      const oldOption = options.find(o => o.id === oldOptionId);
      if (oldOption) {
        oldOption.votes = Math.max(0, oldOption.votes - 1);
      }
    }

    const newOptionId = optionIds[0];
    const newOption = options.find(o => o.id === newOptionId);
    if (newOption) {
      newOption.votes += 1;
    }

    if (existingVote) {
      await prisma.pollVote.update({
        where: { id: existingVote.id },
        data: {
          optionIds: [newOptionId],
        },
      });
    } else {
      await prisma.pollVote.create({
        data: {
          pollId,
          userId,
          optionIds: [newOptionId],
        },
      });
    }
  }

  await prisma.poll.update({
    where: { id: pollId },
    data: {
      options,
    },
  });

  return options;
}

export async function removeVote(pollId: string, userId: string, optionId: number) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
  });

  if (!poll) {
    return null;
  }

  const existingVote = await prisma.pollVote.findUnique({
    where: {
      pollId_userId: {
        pollId,
        userId,
      },
    },
  });

  if (!existingVote) {
    return null;
  }

  const currentOptionIds = existingVote.optionIds as number[];
  const newOptionIds = currentOptionIds.filter(id => id !== optionId);

  const options = poll.options as poll_option[];
  const option = options.find(o => o.id === optionId);
  if (option) {
    option.votes = Math.max(0, option.votes - 1);
  }

  if (newOptionIds.length === 0) {
    await prisma.pollVote.delete({
      where: { id: existingVote.id },
    });
  } else {
    await prisma.pollVote.update({
      where: { id: existingVote.id },
      data: {
        optionIds: newOptionIds,
      },
    });
  }

  await prisma.poll.update({
    where: { id: pollId },
    data: {
      options,
    },
  });

  return options;
}

export async function endPoll(messageId: string) {
  const poll = await prisma.poll.findUnique({
    where: { messageId },
    include: {
      votes: true,
    },
  });

  if (!poll) {
    throw new Error('Poll not found');
  }

  if (poll.ended) {
    throw new Error('Poll has already ended');
  }

  const updatedPoll = await prisma.poll.update({
    where: { id: poll.id },
    data: {
      ended: true,
    },
  });

  return updatedPoll;
}

export async function sendPollExpirationNotification(
  client: { channels: { fetch: (id: string) => Promise<unknown> } },
  pollData: {
    id: string;
    channelId: string;
    question: string;
    options: poll_option[];
  }
): Promise<boolean> {
  try {
    const channel = await client.channels.fetch(pollData.channelId);
    if (!channel || !('send' in channel)) {
      logger.warn({ channelId: pollData.channelId }, 'Channel not found or not text-based for poll expiration');
      return false;
    }

    const options = pollData.options as poll_option[];
    const totalVotes = options.reduce((sum, opt) => sum + opt.votes, 0);
    
    // Find the winner(s)
    const maxVotes = Math.max(...options.map(o => o.votes));
    const winners = options.filter(o => o.votes === maxVotes);
    
    let winnerText: string;
    if (totalVotes === 0) {
      winnerText = 'Sem votos';
    } else if (winners.length === 1) {
      winnerText = `${winners[0].text} com ${winners[0].votes} voto${winners[0].votes !== 1 ? 's' : ''}`;
    } else {
      winnerText = winners.map(w => `${w.text} (${w.votes} votos)`).join(', ');
    }

    const message = `📊 A enquete "${pollData.question}" acabou!\n🏆 Vencedor: ${winnerText}`;

    await channel.send(message);
    return true;
  } catch (error) {
    logger.error({ err: safe_error_details(error), pollId: pollData.id }, 'Failed to send poll expiration notification');
    return false;
  }
}

export function buildPollResultsEmbed(poll: {
  question: string;
  options: poll_option[];
  multiVote: boolean;
  endsAt: Date;
  ended: boolean;
  createdAt: Date;
}) {
  const options = poll.options as poll_option[];
  const totalVotes = options.reduce((sum, opt) => sum + opt.votes, 0);

  const optionsText = options
    .map(opt => {
      const percentage = totalVotes > 0 ? ((opt.votes / totalVotes) * 100).toFixed(1) : '0.0';
      const bar = '█'.repeat(Math.round((opt.votes / (totalVotes || 1)) * 10));
      return `**${opt.id + 1}.** ${opt.text}\n   ${bar} ${opt.votes} votes (${percentage}%)`;
    })
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle('📊 ' + poll.question)
    .setDescription(optionsText)
    .setColor(poll.ended ? Colors.Grey : Colors.Blue)
    .setFooter({
      text: poll.ended
        ? 'Votação encerrada'
        : `Votação ativa • Ends: ${poll.endsAt.toLocaleString('pt-BR')}`,
    })
    .setTimestamp(poll.createdAt);

  return embed;
}

export async function handlePollReactionAdd(
  messageId: string,
  userId: string,
  emoji: string
) {
  try {
    const poll = await getPollByMessageId(messageId);
    if (!poll || poll.ended) {
      return null;
    }

    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const emojiIndex = numberEmojis.indexOf(emoji);

    if (emojiIndex === -1) {
      return null;
    }

    const options = poll.options as poll_option[];
    if (emojiIndex >= options.length) {
      return null;
    }

    const optionId = emojiIndex;
    await vote(poll.id, userId, [optionId], poll.multiVote);

    return poll;
  } catch (error) {
    logger.warn({ err: safe_error_details(error) }, 'Failed to handle poll reaction add');
    return null;
  }
}

export async function handlePollReactionRemove(
  messageId: string,
  userId: string,
  emoji: string
) {
  try {
    const poll = await getPollByMessageId(messageId);
    if (!poll || poll.ended) {
      return null;
    }

    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const emojiIndex = numberEmojis.indexOf(emoji);

    if (emojiIndex === -1) {
      return null;
    }

    const options = poll.options as poll_option[];
    if (emojiIndex >= options.length) {
      return null;
    }

    const optionId = emojiIndex;
    await removeVote(poll.id, userId, optionId);

    return poll;
  } catch (error) {
    logger.warn({ err: safe_error_details(error) }, 'Failed to handle poll reaction remove');
    return null;
  }
}

export async function updatePollMessage(poll: {
  messageId: string;
  channelId: string;
  question: string;
  options: poll_option[];
  multiVote: boolean;
  endsAt: Date;
  ended: boolean;
  createdAt: Date;
}, client: { channels: { fetch: (id: string) => Promise<{ isTextBased: () => boolean; messages: { edit: (id: string, data: unknown) => Promise<unknown> } } | null> } }) {
  try {
    const channel = await client.channels.fetch(poll.channelId);
    if (!channel || !channel.isTextBased()) {
      return null;
    }

    const embed = buildPollResultsEmbed(poll);
    await channel.messages.edit(poll.messageId, { embeds: [embed] });

    return true;
  } catch (error) {
    logger.warn({ err: safe_error_details(error) }, 'Failed to update poll message');
    return null;
  }
}

export const pollService = {
  createPoll,
  getPollByMessageId,
  getPollById,
  vote,
  removeVote,
  endPoll,
  buildPollResultsEmbed,
  handlePollReactionAdd,
  handlePollReactionRemove,
  updatePollMessage,
  sendPollExpirationNotification,
};
