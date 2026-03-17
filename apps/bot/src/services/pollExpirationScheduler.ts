import { Client } from 'discord.js';
import { prisma } from '@yuebot/database';

import { logger } from '../utils/logger';
import { safe_error_details } from '../utils/safe_error';
import { pollService, poll_option } from './poll.service';

export class PollExpirationScheduler {
  private interval: NodeJS.Timeout | null = null;
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  start() {
    if (this.interval) return;

    this.interval = setInterval(() => {
      void this.tick();
    }, 60_000);

    void this.tick();
    logger.info('📊 Poll expiration scheduler started');
  }

  stop() {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
    logger.info('📊 Poll expiration scheduler stopped');
  }

  private async tick() {
    try {
      const now = new Date();

      const expiredPolls = await prisma.poll.findMany({
        where: {
          ended: false,
          endsAt: { lte: now },
        },
        orderBy: { endsAt: 'asc' },
        take: 50,
      });

      for (const poll of expiredPolls) {
        await this.handlePollExpiration(poll);
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Error processing poll expiration scheduler');
    }
  }

  private async handlePollExpiration(poll: {
    id: string;
    channelId: string;
    messageId: string;
    question: string;
    options: poll_option[];
    multiVote: boolean;
    endsAt: Date;
    ended: boolean;
    createdAt: Date;
  }) {
    try {
      // Mark the poll as ended
      await prisma.poll.update({
        where: { id: poll.id },
        data: { ended: true },
      });

      // Send notification to the channel
      await pollService.sendPollExpirationNotification(
        this.client as unknown as Parameters<typeof pollService.sendPollExpirationNotification>[0],
        {
          id: poll.id,
          channelId: poll.channelId,
          question: poll.question,
          options: poll.options,
        }
      );

      // Update the poll message to show ended status
      await pollService.updatePollMessage(
        {
          messageId: poll.messageId,
          channelId: poll.channelId,
          question: poll.question,
          options: poll.options,
          multiVote: poll.multiVote,
          endsAt: poll.endsAt,
          ended: true,
          createdAt: poll.createdAt,
        },
        this.client as unknown as Parameters<typeof pollService.updatePollMessage>[1]
      );

      logger.info({ pollId: poll.id, question: poll.question }, 'Poll expired and notification sent');
    } catch (error) {
      logger.error(
        { err: safe_error_details(error), pollId: poll.id },
        'Failed to process poll expiration'
      );
    }
  }
}
