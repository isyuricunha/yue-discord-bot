type panel_ai_page_shape = {
  readonly key: string
  readonly routePattern: string
  readonly title: string
  readonly section: string
  readonly purpose: string
}

export const PANEL_AI_PAGES = [
  {
    key: 'member-details',
    routePattern: '/guild/:guildId/members/:userId',
    title: 'Detalhes do Membro',
    section: 'Admin',
    purpose: 'View detailed server member history and warnings, edit moderation notes, and perform actions like timeout, kick, or ban.',
  },
  {
    key: 'giveaway-create',
    routePattern: '/guild/:guildId/giveaways/create',
    title: 'Criar Sorteio',
    section: 'Admin',
    purpose: 'Configure and launch a new giveaway in the server, setting entry requirements, reward items, duration, and channel.',
  },
  {
    key: 'giveaway-details',
    routePattern: '/guild/:guildId/giveaways/:giveawayId',
    title: 'Detalhes do Sorteio',
    section: 'Admin',
    purpose: 'View giveaway status, entries, and winners, and perform actions like cancel, end early, or download entry list.',
  },
  {
    key: 'overview',
    routePattern: '/guild/:guildId/overview',
    title: 'Visão geral',
    section: 'Primeiros passos',
    purpose: 'View server statistics, member growth charts, and recent moderation activity logs.',
  },
  {
    key: 'automod',
    routePattern: '/guild/:guildId/automod',
    title: 'AutoMod',
    section: 'Moderação & logs',
    purpose: 'Configure automatic moderation rules for word filters, excessive caps, link filters, and AI-assisted content moderation.',
  },
  {
    key: 'antiraid',
    routePattern: '/guild/:guildId/antiraid',
    title: 'Anti-Raide',
    section: 'Moderação & logs',
    purpose: 'Configure raid detection settings based on join rate limits, actions like mute or ban, exemptions, and notification channels.',
  },
  {
    key: 'modlogs',
    routePattern: '/guild/:guildId/modlogs',
    title: 'Logs',
    section: 'Moderação & logs',
    purpose: 'Configure the channel and message template for moderation logs, view and filter recent moderation actions, and export logs.',
  },
  {
    key: 'music',
    routePattern: '/guild/:guildId/music',
    title: 'Música',
    section: 'Engajamento',
    purpose: 'Control the active music playback session, adjust player volume, skip tracks, and view the current queue.',
  },
  {
    key: 'custom-commands',
    routePattern: '/guild/:guildId/custom-commands',
    title: 'Custom Commands',
    section: 'Engajamento',
    purpose: 'Create, update, and delete custom bot commands that return static text responses.',
  },
  {
    key: 'keyword-triggers',
    routePattern: '/guild/:guildId/keyword-triggers',
    title: 'Gatilhos',
    section: 'Engajamento',
    purpose: 'Configure automatic bot responses triggered by specific keywords, including message content, media attachments, and channel restrictions.',
  },
  {
    key: 'audit',
    routePattern: '/guild/:guildId/audit',
    title: 'Audit',
    section: 'Moderação & logs',
    purpose: 'Configure the bot audit log channel, and search and filter the bot audit log history of server events.',
  },
  {
    key: 'commands',
    routePattern: '/guild/:guildId/commands',
    title: 'Comandos',
    section: 'Primeiros passos',
    purpose: 'View default bot slash and context menu commands, search through them, and toggle their enabled status.',
  },
  {
    key: 'members',
    routePattern: '/guild/:guildId/members',
    title: 'Membros',
    section: 'Admin',
    purpose: 'View, filter, and search server members, listing their join dates and total warning counts.',
  },
  {
    key: 'giveaways',
    routePattern: '/guild/:guildId/giveaways',
    title: 'Sorteios',
    section: 'Admin',
    purpose: 'Configure the default giveaway channel, and view and manage active or ended server giveaways.',
  },
  {
    key: 'xp',
    routePattern: '/guild/:guildId/xp',
    title: 'XP',
    section: 'Engajamento',
    purpose: 'Configure the server experience (XP) system, including message/voice rates, multipliers, ignored channels/roles, level-up announcements, and level rewards.',
  },
  {
    key: 'autorole',
    routePattern: '/guild/:guildId/autorole',
    title: 'Autorole',
    section: 'Automações',
    purpose: 'Configure roles automatically assigned to members when they join, with options for delay time and first-message requirement.',
  },
  {
    key: 'tickets',
    routePattern: '/guild/:guildId/tickets',
    title: 'Tickets',
    section: 'Suporte',
    purpose: 'Configure support ticket category, logging channels, support staff roles, and panel channel, and view the list of tickets.',
  },
  {
    key: 'support',
    routePattern: '/guild/:guildId/support',
    title: 'Apoios',
    section: 'Suporte',
    purpose: 'Configure support plans, link LivePix accounts, view payments history, and manage temporary role entitlements.',
  },
  {
    key: 'suggestions',
    routePattern: '/guild/:guildId/suggestions',
    title: 'Sugestões',
    section: 'Engajamento',
    purpose: 'Configure suggestion target and log channels, and view, filter, and track server suggestions.',
  },
  {
    key: 'reaction-roles',
    routePattern: '/guild/:guildId/reaction-roles',
    title: 'Reaction Roles',
    section: 'Engajamento',
    purpose: 'Configure reaction role panels, allowing members to obtain roles by reacting to bot messages with specific emojis.',
  },
  {
    key: 'starboard',
    routePattern: '/guild/:guildId/starboard',
    title: 'Starboard',
    section: 'Engajamento',
    purpose: 'Configure the starboard feature, including target channel, emoji, star threshold, and bot message exemption.',
  },
  {
    key: 'free-games',
    routePattern: '/guild/:guildId/free-games',
    title: 'Jogos Grátis',
    section: 'Engajamento',
    purpose: 'Configure automatic promotion and free game notifications, specifying announcement channels, mention roles, platforms, and giveaway types.',
  },
  {
    key: 'setup',
    routePattern: '/guild/:guildId/setup',
    title: 'Setup',
    section: 'Primeiros passos',
    purpose: 'A step-by-step wizard to guide through initial configurations of welcome messages, modlogs, AutoMod, autorole, tickets, and XP.',
  },
  {
    key: 'moderation',
    routePattern: '/guild/:guildId/moderation',
    title: 'Moderação',
    section: 'Moderação & logs',
    purpose: 'Configure mute roles and AI moderation rules (severity, action, and category thresholds).',
  },
  {
    key: 'welcome',
    routePattern: '/guild/:guildId/welcome',
    title: 'Boas-vindas',
    section: 'Automações',
    purpose: 'Configure welcome and leave announcement channels, customize message templates, and preview rendered outputs.',
  },
  {
    key: 'settings',
    routePattern: '/guild/:guildId/settings',
    title: 'Configurações',
    section: 'Admin',
    purpose: 'Configure timezone and language preferences for the bot in the server.',
  },
  {
    key: 'assistant',
    routePattern: '/guild/:guildId/assistant',
    title: 'Ella',
    section: 'Primeiros passos',
    purpose: 'Interact with Ella, the AI assistant, in a full-page chat interface.',
  },
  {
    key: 'guild-root',
    routePattern: '/guild/:guildId',
    title: 'Painel',
    section: 'Primeiros passos',
    purpose: 'View the guild summary card and a grouped list of all available configuration modules.',
  },
] as const satisfies readonly panel_ai_page_shape[]

export type panel_ai_page_definition = (typeof PANEL_AI_PAGES)[number]
export type panel_ai_page_key = panel_ai_page_definition['key']

// Runtime freeze
Object.freeze(PANEL_AI_PAGES)
for (const p of PANEL_AI_PAGES) {
  Object.freeze(p)
}

export function find_panel_ai_page(key: string): panel_ai_page_definition | undefined {
  return PANEL_AI_PAGES.find((p) => p.key === key)
}
