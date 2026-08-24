import { find_panel_ai_page, type panel_ai_page_key } from './panel_ai_pages'

export type panel_ai_page_context = {
  pageKey: panel_ai_page_key
  routeParams?: Record<string, string>
}

export type panel_ai_prefill_value = string | number | boolean

export type panel_ai_prefill_change = {
  target: string
  targetLabel: string
  value: panel_ai_prefill_value
}

export type panel_ai_action =
  | {
      id: string
      type: 'navigate'
      pageKey: panel_ai_page_key
      label: string
    }
  | {
      id: string
      type: 'open_section' | 'highlight_setting'
      pageKey: panel_ai_page_key
      target: string
      targetLabel: string
      label: string
    }
  | {
      id: string
      type: 'prefill_form'
      pageKey: panel_ai_page_key
      changes: panel_ai_prefill_change[]
      label: string
    }

export type panel_ai_sensitive_scope =
  | 'member_moderation'
  | 'recent_modlogs'
  | 'recent_tickets'
  | 'giveaway_participants'

export type panel_ai_sensitive_request = {
  id: string
  scope: panel_ai_sensitive_scope
  title: string
  description: string
  preview: string
  expiresAt: string
}

type action_target = {
  label: string
}

type page_action_targets = {
  sections?: Record<string, action_target>
  settings?: Record<string, action_target>
}

export const PANEL_AI_ACTION_TARGETS: Partial<Record<panel_ai_page_key, page_action_targets>> = {
  settings: {
    sections: {
      localization: { label: 'Idioma e fuso horário' },
      audit: { label: 'Canal de auditoria' },
    },
    settings: {
      locale: { label: 'Idioma' },
      timezone: { label: 'Fuso horário' },
      auditLogChannelId: { label: 'Canal de auditoria' },
    },
  },
  welcome: {
    sections: {
      channels: { label: 'Canais' },
      messages: { label: 'Mensagens' },
    },
    settings: {
      welcomeChannelId: { label: 'Canal de boas-vindas' },
      leaveChannelId: { label: 'Canal de saída' },
      welcomeMessage: { label: 'Mensagem de boas-vindas' },
      leaveMessage: { label: 'Mensagem de saída' },
    },
  },
  automod: {
    sections: {
      words: { label: 'Filtro de palavras' },
      caps: { label: 'Anti-CAPS' },
      links: { label: 'Proteção de links' },
      ai: { label: 'Moderação por IA' },
    },
    settings: {
      capsThreshold: { label: 'Limite de CAPS (%)' },
      capsMinLength: { label: 'Tamanho mínimo' },
      linkAction: { label: 'Ação' },
      aiModerationLevel: { label: 'Nível de moderação' },
    },
  },
  antiraid: {
    sections: {
      detection: { label: 'Detecção' },
      action: { label: 'Ação' },
      exemptions: { label: 'Exceções' },
      notifications: { label: 'Notificações' },
    },
    settings: {
      joinThreshold: { label: 'Limite de entradas' },
      joinTimeWindow: { label: 'Janela de tempo' },
      duration: { label: 'Duração' },
      cooldown: { label: 'Cooldown' },
    },
  },
  xp: {
    sections: {
      rates: { label: 'Configuração de XP' },
      voice: { label: 'XP por voz' },
      rewards: { label: 'Recompensas' },
      levelup: { label: 'Level Up' },
    },
    settings: {
      xpMode: { label: 'Modo de XP' },
      xpPerMessage: { label: 'XP por mensagem' },
      xpPerVoiceMinute: { label: 'XP por minuto em voz' },
      rewardMode: { label: 'Modo de recompensas' },
    },
  },
  autorole: {
    sections: {
      roles: { label: 'Cargos automáticos' },
      timing: { label: 'Atraso e primeira mensagem' },
    },
    settings: {
      delaySeconds: { label: 'Atraso' },
      onlyAfterFirstMessage: { label: 'Somente após primeira mensagem' },
    },
  },
  tickets: {
    sections: {
      configuration: { label: 'Configuração de Tickets' },
      list: { label: 'Tickets' },
    },
    settings: {
      categoryId: { label: 'Categoria' },
      logChannelId: { label: 'Canal de logs' },
      supportRoleIds: { label: 'Cargos de suporte' },
      panelChannelId: { label: 'Canal do painel' },
    },
  },
  commands: {
    sections: {
      commands: { label: 'Comandos' },
      cooldowns: { label: 'Cooldowns' },
    },
  },
  suggestions: {
    sections: {
      configuration: { label: 'Configuração de Sugestões' },
      list: { label: 'Sugestões' },
    },
  },
  'reaction-roles': {
    sections: {
      panels: { label: 'Painéis de Reaction Roles' },
    },
  },
  starboard: {
    sections: {
      configuration: { label: 'Configuração do Starboard' },
      posts: { label: 'Posts do Starboard' },
    },
  },
  'free-games': {
    sections: {
      configuration: { label: 'Configuração de jogos grátis' },
    },
  },
  modlogs: {
    sections: {
      configuration: { label: 'Configuração de logs' },
      history: { label: 'Histórico de moderação' },
    },
  },
  giveaways: {
    sections: {
      configuration: { label: 'Configuração de sorteios' },
      list: { label: 'Sorteios' },
    },
  },
  members: {
    sections: {
      list: { label: 'Membros' },
    },
  },
} as const

type integer_prefill_field = {
  label: string
  control: 'input'
  valueType: 'integer'
  min: number
  max: number
}

type boolean_prefill_field = {
  label: string
  control: 'switch'
  valueType: 'boolean'
  ariaLabel: string
}

type enum_prefill_option = {
  value: string
  label: string
}

type enum_prefill_field = {
  label: string
  control: 'select'
  valueType: 'enum'
  options: readonly enum_prefill_option[]
}

type string_prefill_field = {
  label: string
  control: 'message_editor'
  valueType: 'string'
  maxLength: number
}

export type panel_ai_prefill_field =
  | integer_prefill_field
  | boolean_prefill_field
  | enum_prefill_field
  | string_prefill_field

export const PANEL_AI_PREFILL_FIELDS: Partial<Record<panel_ai_page_key, Record<string, panel_ai_prefill_field>>> = {
  automod: {
    capsEnabled: {
      label: 'Anti-CAPS',
      control: 'switch',
      valueType: 'boolean',
      ariaLabel: 'Habilitar Anti-CAPS',
    },
    capsThreshold: {
      label: 'Limite de CAPS (%)',
      control: 'input',
      valueType: 'integer',
      min: 0,
      max: 100,
    },
    capsMinLength: {
      label: 'Tamanho mínimo',
      control: 'input',
      valueType: 'integer',
      min: 1,
      max: 500,
    },
    aiModerationEnabled: {
      label: 'Moderação por IA',
      control: 'switch',
      valueType: 'boolean',
      ariaLabel: 'Habilitar moderação por IA',
    },
    aiModerationLevel: {
      label: 'Nível de detecção',
      control: 'select',
      valueType: 'enum',
      options: [
        { value: 'permissivo', label: 'Permissivo' },
        { value: 'brando', label: 'Brando' },
        { value: 'medio', label: 'Médio' },
        { value: 'rigoroso', label: 'Rigoroso' },
        { value: 'maximo', label: 'Máximo' },
      ],
    },
  },
  antiraid: {
    enabled: {
      label: 'Proteção contra Raide',
      control: 'switch',
      valueType: 'boolean',
      ariaLabel: 'Habilitar Anti-Raide',
    },
    joinThreshold: {
      label: 'Limite de entradas',
      control: 'input',
      valueType: 'integer',
      min: 3,
      max: 50,
    },
    joinTimeWindow: {
      label: 'Janela de tempo (segundos)',
      control: 'input',
      valueType: 'integer',
      min: 10,
      max: 300,
    },
    cooldown: {
      label: 'Cooldown após raide (segundos)',
      control: 'input',
      valueType: 'integer',
      min: 60,
      max: 3_600,
    },
  },
  xp: {
    enabled: {
      label: 'Ativar XP (Chat)',
      control: 'switch',
      valueType: 'boolean',
      ariaLabel: 'XP em Texto habilitado',
    },
    voiceXpEnabled: {
      label: 'Ativar Voice XP (Voz)',
      control: 'switch',
      valueType: 'boolean',
      ariaLabel: 'Voice XP habilitado',
    },
    voiceXpNotificationsEnabled: {
      label: 'Notificações de XP por Voz',
      control: 'switch',
      valueType: 'boolean',
      ariaLabel: 'Notificações habilitadas',
    },
    voiceXpRate: {
      label: 'Pontos a cada 10 minutos (Voice Rate)',
      control: 'input',
      valueType: 'integer',
      min: 1,
      max: 10_000,
    },
    rewardMode: {
      label: 'Modo de recompensas',
      control: 'select',
      valueType: 'enum',
      options: [
        { value: 'stack', label: 'Empilhar recompensas anteriores' },
        { value: 'highest', label: 'Remover recompensas anteriores' },
      ],
    },
  },
  autorole: {
    enabled: {
      label: 'Ativar autorole',
      control: 'switch',
      valueType: 'boolean',
      ariaLabel: 'Autorole habilitado',
    },
    delaySeconds: {
      label: 'Aguardar (segundos)',
      control: 'input',
      valueType: 'integer',
      min: 0,
      max: 7 * 24 * 60 * 60,
    },
    onlyAfterFirstMessage: {
      label: 'Somente após primeira mensagem',
      control: 'switch',
      valueType: 'boolean',
      ariaLabel: 'Após mensagem',
    },
  },
  settings: {
    locale: {
      label: 'Idioma',
      control: 'select',
      valueType: 'enum',
      options: [
        { value: 'pt-BR', label: 'Português (Brasil)' },
        { value: 'en-US', label: 'English (US)' },
        { value: 'es-ES', label: 'Español' },
      ],
    },
    timezone: {
      label: 'Fuso horário',
      control: 'select',
      valueType: 'enum',
      options: [
        { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
        { value: 'America/New_York', label: 'New York (EST)' },
        { value: 'Europe/London', label: 'London (GMT)' },
        { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
      ],
    },
  },
  welcome: {
    welcomeMessage: {
      label: 'Mensagem de boas-vindas',
      control: 'message_editor',
      valueType: 'string',
      maxLength: 4_000,
    },
    leaveMessage: {
      label: 'Mensagem de saída',
      control: 'message_editor',
      valueType: 'string',
      maxLength: 4_000,
    },
  },
}

export function get_panel_ai_prefill_field(
  pageKey: panel_ai_page_key,
  target: string,
): panel_ai_prefill_field | null {
  return PANEL_AI_PREFILL_FIELDS[pageKey]?.[target] ?? null
}

export function validate_panel_ai_prefill_value(
  pageKey: panel_ai_page_key,
  target: string,
  value: unknown,
): { value: panel_ai_prefill_value } | null {
  const field = get_panel_ai_prefill_field(pageKey, target)
  if (!field) return null

  if (field.valueType === 'boolean') {
    return typeof value === 'boolean' ? { value } : null
  }

  if (field.valueType === 'integer') {
    return typeof value === 'number' && Number.isInteger(value) && value >= field.min && value <= field.max
      ? { value }
      : null
  }

  if (field.valueType === 'enum') {
    if (typeof value !== 'string') return null
    return field.options.some((option) => option.value === value) ? { value } : null
  }

  if (typeof value !== 'string' || value.length > field.maxLength) return null
  return { value }
}

export function describe_panel_ai_prefill_field(field: panel_ai_prefill_field): string {
  if (field.valueType === 'boolean') return 'boolean'
  if (field.valueType === 'integer') return `integer[${field.min},${field.max}]`
  if (field.valueType === 'enum') return `enum[${field.options.map((option) => option.value).join('|')}]`
  return `string[max=${field.maxLength}]`
}

const DEFAULT_QUICK_PROMPTS = [
  'O que posso configurar nesta página?',
  'Revise esta configuração e aponte melhorias.',
  'Explique o que é mais importante aqui.',
] as const

const QUICK_PROMPTS: Partial<Record<panel_ai_page_key, readonly string[]>> = {
  'member-details': ['Resuma o histórico deste membro.', 'O que devo observar antes de moderar?', 'Explique os dados disponíveis nesta página.'],
  'giveaway-create': ['Revise as opções deste sorteio.', 'Como escolher duração e quantidade de vencedores?', 'Quais requisitos de entrada fazem sentido?'],
  'giveaway-details': ['Resuma o estado deste sorteio.', 'O que ainda posso fazer com este sorteio?', 'Há algo importante para conferir aqui?'],
  overview: ['Resuma a situação deste servidor.', 'O que merece minha atenção primeiro?', 'Quais áreas do painel vale revisar?'],
  automod: ['Revise meu AutoMod.', 'Como deixar a moderação mais rígida sem exagerar?', 'Explique os filtros configurados aqui.'],
  antiraid: ['Revise meu Anti-Raide.', 'Explique estes limites de detecção.', 'Como equilibrar proteção e falsos positivos?'],
  modlogs: ['Resuma a atividade de moderação.', 'Como interpretar estes logs?', 'Há sinais de ações repetidas aqui?'],
  music: ['O que posso controlar nesta página?', 'Explique como funciona a fila de música.', 'Como resolver problemas comuns de reprodução?'],
  'custom-commands': ['Como organizar meus comandos personalizados?', 'O que faz um bom comando personalizado?', 'Revise a estrutura dos meus comandos.'],
  'keyword-triggers': ['Como evitar gatilhos muito amplos?', 'Revise a estratégia dos gatilhos.', 'Explique as restrições disponíveis aqui.'],
  audit: ['Como usar o Audit para investigar eventos?', 'Quais filtros devo usar primeiro?', 'Explique a diferença entre Audit e Modlogs.'],
  commands: ['Revise meus comandos desativados.', 'Explique os cooldowns configurados.', 'Quais comandos vale manter disponíveis?'],
  members: ['O que posso analisar na lista de membros?', 'Como identificar membros que exigem atenção?', 'Explique os dados mostrados aqui.'],
  giveaways: ['Resuma meus sorteios.', 'O que devo conferir antes de criar outro sorteio?', 'Explique os estados dos sorteios.'],
  xp: ['Revise meu sistema de XP.', 'Explique como o XP está sendo calculado.', 'Como equilibrar progressão e recompensas?'],
  autorole: ['Revise meu Autorole.', 'Quando vale usar atraso no Autorole?', 'Explique a opção de primeira mensagem.'],
  tickets: ['Revise minha configuração de Tickets.', 'Como organizar cargos e canais de suporte?', 'Resuma o estado dos tickets.'],
  support: ['Explique como funcionam os apoios.', 'O que devo conferir nos planos de apoio?', 'Como funcionam os cargos temporários?'],
  suggestions: ['Revise minha configuração de Sugestões.', 'Resuma o estado das sugestões.', 'Como organizar melhor o fluxo de sugestões?'],
  'reaction-roles': ['Revise meus painéis de Reaction Roles.', 'Como organizar cargos em painéis?', 'Explique os modos disponíveis.'],
  starboard: ['Revise meu Starboard.', 'Como escolher um bom limite de estrelas?', 'Resuma a atividade do Starboard.'],
  'free-games': ['Revise as notificações de jogos grátis.', 'Explique os filtros de plataforma.', 'Como evitar notificações demais?'],
  setup: ['O que ainda falta configurar?', 'Qual ordem de configuração você recomenda?', 'Explique este passo do Setup.'],
  moderation: ['Revise as opções de moderação.', 'Explique as ações e severidades.', 'Como manter uma política de moderação consistente?'],
  welcome: ['Revise minhas boas-vindas.', 'Como melhorar as mensagens de entrada e saída?', 'Confira se os canais estão configurados.'],
  settings: ['Revise as configurações gerais.', 'Explique idioma e fuso horário.', 'O que o canal de auditoria faz?'],
  assistant: ['O que você sabe sobre este servidor?', 'Revise as configurações mais importantes.', 'Em quais páginas você consegue me ajudar?'],
  'guild-root': ['O que devo configurar primeiro?', 'Revise o que já está configurado.', 'Quais módulos são mais importantes para este servidor?'],
}

export function get_panel_ai_quick_prompts(pageKey: panel_ai_page_key | null | undefined): readonly string[] {
  return (pageKey && QUICK_PROMPTS[pageKey]) || DEFAULT_QUICK_PROMPTS
}

export function get_panel_ai_action_target(
  pageKey: panel_ai_page_key,
  type: 'open_section' | 'highlight_setting',
  target: string,
): action_target | null {
  const page = PANEL_AI_ACTION_TARGETS[pageKey]
  const registry = type === 'open_section' ? page?.sections : page?.settings
  return registry?.[target] ?? null
}

export function build_panel_ai_page_path(
  pageKey: panel_ai_page_key,
  guildId: string,
  routeParams: Record<string, string> = {},
): string | null {
  const page = find_panel_ai_page(pageKey)
  if (!page) return null
  let path = page.routePattern.replace(':guildId', encodeURIComponent(guildId))
  for (const match of path.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const key = match[1]
    const value = routeParams[key]
    if (!value) return null
    path = path.replace(`:${key}`, encodeURIComponent(value))
  }
  return path
}
