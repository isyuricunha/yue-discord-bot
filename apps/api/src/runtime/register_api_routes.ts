import type { FastifyInstance } from 'fastify';
import authRoutes from '../routes/auth';
import guildRoutes from '../routes/guilds';
import giveawayRoutes from '../routes/giveaways';
import giveawayEntryEditRoutes from '../routes/giveawayEntryEdit';
import xpRoutes from '../routes/xp.routes';
import { statsRoutes } from '../routes/stats.routes';
import { exportRoutes } from '../routes/export.routes';
import { membersRoutes } from '../routes/members.routes';
import { profileRoutes } from '../routes/profile.routes';
import { badgesRoutes } from '../routes/badges.routes';
import { fanartsRoutes } from '../routes/fanarts.routes';
import { economyRoutes } from '../routes/economy.routes';
import { coinflipRoutes } from '../routes/coinflip.routes';
import { ownerRoutes } from '../routes/owner.routes';
import { panelAiOwnerRoutes } from '../routes/panel_ai_owner.routes';
import { panelAiRoutes } from '../routes/panel_ai.routes';
import { panelAiApplyRoutes } from '../routes/panel_ai_apply.routes';
import { auditRoutes } from '../routes/audit.routes';
import { triggersRoutes } from '../routes/triggers.routes';
import { supportRoutes } from '../routes/support.routes';
import { livePixRoutes } from '../routes/livepix.routes';

export function registerApiRoutes(app: FastifyInstance): void {
  app.register(authRoutes, { prefix: '/api/auth' });

  app.register(guildRoutes, { prefix: '/api/guilds' });
  app.register(supportRoutes, { prefix: '/api/guilds' });

  app.register(xpRoutes, { prefix: '/api/xp' });

  app.register(giveawayRoutes, { prefix: '/api/guilds' });
  app.register(giveawayEntryEditRoutes, { prefix: '/api' });

  app.register(statsRoutes, { prefix: '/api' });
  app.register(exportRoutes, { prefix: '/api' });
  app.register(membersRoutes, { prefix: '/api' });

  app.register(profileRoutes, { prefix: '/api' });
  app.register(badgesRoutes, { prefix: '/api' });
  app.register(fanartsRoutes, { prefix: '/api' });

  app.register(economyRoutes, { prefix: '/api' });
  app.register(coinflipRoutes, { prefix: '/api' });

  app.register(auditRoutes, { prefix: '/api' });
  app.register(triggersRoutes, { prefix: '/api/guilds' });

  app.register(ownerRoutes, { prefix: '/api' });
  app.register(panelAiOwnerRoutes, { prefix: '/api' });
  app.register(panelAiRoutes, { prefix: '/api' });
  app.register(panelAiApplyRoutes, { prefix: '/api' });

  app.register(livePixRoutes, { prefix: '/api' });
}
