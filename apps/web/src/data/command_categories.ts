// Categorias da documentação de comandos.
// O catálogo (commands.generated.json) é gerado dos SlashCommandBuilders
// reais; este mapa agrupa cada comando por seção da documentação.
// Ao criar um comando novo, adicione-o na categoria correspondente.

export type command_category = {
  id: string
  label: string
  description: string
  commands: string[]
}

export type context_menu_category = {
  label: string
  commands: string[]
}

export const command_categories: command_category[] = [
  {
    id: 'administracao',
    label: 'Administração do servidor',
    description: 'Configuração da Yue e atalhos para o painel web.',
    commands: ['config', 'painel'],
  },
  {
    id: 'moderacao',
    label: 'Moderação',
    description: 'Banimentos, avisos, silenciamentos, modlog e proteção antiraid.',
    commands: [
      'ban', 'kick', 'mute', 'unmute', 'warn', 'unwarn',
      'modlog', 'baninfo', 'antiraide', 'limpar', 'lock', 'unlock', 'report',
    ],
  },
  {
    id: 'utilidades',
    label: 'Utilidades',
    description: 'Ferramentas do dia a dia: enquetes, AFK, aniversários, estatísticas e mais.',
    commands: [
      'ping', 'say', 'ticket', 'evento', 'pet', 'trivia', 'enquete', 'afk',
      'voltei', 'aniversario', 'jogosgratis', 'gatilho', 'estatisticas',
      'apoiar', 'ask', 'reactionroles',
    ],
  },
  {
    id: 'sorteios',
    label: 'Sorteios',
    description: 'Criação e acompanhamento de sorteios no servidor.',
    commands: ['sorteio', 'sorteio-lista', 'sorteio-wizard'],
  },
  {
    id: 'xp',
    label: 'XP e níveis',
    description: 'Progressão por atividade: rank, leaderboard, prestígio e transferências.',
    commands: ['rank', 'leaderboard', 'nivel', 'prestige', 'transferir'],
  },
  {
    id: 'perfil',
    label: 'Perfil e badges',
    description: 'Perfil público e coleção de badges dos membros.',
    commands: ['profile', 'badges'],
  },
  {
    id: 'autenticadas',
    label: 'Mensagens autenticadas',
    description: 'Mensagens especiais assinadas pela Yue e o fluxo de verificação.',
    commands: ['verificarmensagem'],
  },
  {
    id: 'fanart',
    label: 'Fan art',
    description: 'Envio e exibição de fan arts da comunidade.',
    commands: ['fanart'],
  },
  {
    id: 'anime',
    label: 'Anime (AniList)',
    description: 'Busca de animes e Pokédex.',
    commands: ['anime', 'pokedex'],
  },
  {
    id: 'economia',
    label: 'Economia (luazinhas)',
    description: 'Moeda do servidor: recompensa diária, loja, inventário e banco.',
    commands: ['luazinhas', 'loja', 'inventario', 'banco', 'diario'],
  },
  {
    id: 'jogos',
    label: 'Jogos',
    description: 'Minijogos rápidos.',
    commands: ['coinflip'],
  },
  {
    id: 'waifu',
    label: 'Waifu e casamento',
    description: 'Rolls, desejo, harem, casamento e ranking da comunidade.',
    commands: [
      'waifu', 'husbando', 'casar', 'reroll', 'meuharem', 'divorciar',
      'infocasamento', 'desejos', 'waifupontos', 'wishlist', 'harem',
      'marry', 'divorce', 'ranking',
    ],
  },
  {
    id: 'musica',
    label: 'Música',
    description: 'Player de música com suporte a filas e playlists.',
    commands: ['play', 'skip', 'stop', 'volume', 'queue', 'playlist', 'nowplaying', 'dj'],
  },
]

// Comandos de mensagem (context menu), agrupados à parte porque no Discord
// eles aparecem no menu de contexto da mensagem, não no slash.
export const context_menu_categories: context_menu_category[] = [
  {
    label: 'Mensagens autenticadas',
    commands: [
      'Salvar mensagem (Enviar aqui)',
      'Salvar mensagem (Enviar na DM)',
      'Reportar mensagem',
    ],
  },
]

export const uncategorized: command_category = {
  id: 'outros',
  label: 'Outros',
  description: 'Comandos ainda não categorizados.',
  commands: [],
}

const slash_by_category = new Map<string, command_category>()
for (const category of command_categories) {
  for (const name of category.commands) slash_by_category.set(name, category)
}

export function category_for_command(name: string): command_category {
  return slash_by_category.get(name) ?? uncategorized
}
