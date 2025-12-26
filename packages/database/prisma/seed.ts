import { prisma } from '../src/index';

type safe_error_details_payload = {
  name?: string
  message: string
  code?: string
}

function safe_error_details(error: unknown): safe_error_details_payload {
  if (error instanceof Error) {
    const any_error = error as unknown as { code?: unknown }

    const details: safe_error_details_payload = {
      name: error.name,
      message: error.message,
    }

    if (typeof any_error.code === 'string') {
      details.code = any_error.code
    }

    return details
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  return { message: 'Unknown error' }
}

async function main() {
  await prisma.$connect();

  const badges = [
    { id: 'community_news_notifier', name: 'Novidades', description: 'Notificações de novidades ativas', category: 'community', icon: '📰', hidden: false },
    { id: 'community_vote_24h', name: 'Voto recente', description: 'Votou recentemente (expira em 24h)', category: 'community', icon: '🗳️', hidden: false },
    { id: 'community_sticker_artist', name: 'Sticker artist', description: 'Contribuiu com stickers/figurinhas', category: 'community', icon: '🎨', hidden: false },
    { id: 'community_team', name: 'Equipe', description: 'Membro da equipe do projeto', category: 'community', icon: '🛡️', hidden: false },
    { id: 'community_artist', name: 'Artista', description: 'Criou artes oficiais/comunitárias', category: 'community', icon: '🖌️', hidden: false },
    { id: 'community_donor', name: 'Apoiador', description: 'Apoiou o projeto', category: 'community', icon: '💖', hidden: false },
    { id: 'community_donor_tier_max', name: 'Apoiador máximo', description: 'Plano de apoio mais alto', category: 'community', icon: '💎', hidden: false },
    { id: 'community_github_contributor', name: 'Contribuidor', description: 'Contribuiu no código (GitHub)', category: 'community', icon: '💻', hidden: false },

    { id: 'feature_married', name: 'Casado', description: 'Casamento registrado no bot', category: 'system', icon: '💍', hidden: false },
    { id: 'feature_married_1_month', name: 'Casado há 1 mês', description: 'Casamento há mais de um mês', category: 'system', icon: '🗓️', hidden: false },
    { id: 'feature_homewrecker', name: 'Talarico', description: 'Interagiu com alguém comprometido (ação social)', category: 'system', icon: '😈', hidden: false },
    { id: 'feature_stock_profit', name: 'Investidor', description: 'Obteve lucro positivo em investimento', category: 'system', icon: '📈', hidden: false },
    { id: 'community_translator', name: 'Tradutor', description: 'Ajudou com traduções', category: 'community', icon: '🌐', hidden: false },

    { id: 'merch_mug', name: 'Caneca', description: 'Comprou a caneca oficial', category: 'community', icon: '☕', hidden: false },
    { id: 'merch_hoodie', name: 'Moletom', description: 'Comprou o moletom oficial', category: 'community', icon: '🧥', hidden: false },
    { id: 'merch_album_complete', name: 'Álbum completo', description: 'Concluiu o álbum de figurinhas', category: 'community', icon: '📒', hidden: false },

    { id: 'event_easter_10', name: 'Evento: Páscoa', description: 'Coletou 10 pontos no evento', category: 'event', icon: '🥚', hidden: false },
    { id: 'event_halloween_400', name: 'Evento: Halloween', description: 'Coletou 400 pontos no evento', category: 'event', icon: '🎃', hidden: false },
    { id: 'event_winter_2019_400', name: 'Evento: Inverno 2019', description: 'Coletou 400 pontos no evento', category: 'event', icon: '🎁', hidden: false },
    { id: 'event_winter_2022_100', name: 'Evento: Inverno 2022', description: 'Coletou 100 pontos no evento', category: 'event', icon: '❄️', hidden: false },
    { id: 'event_anniversary_3y_team', name: 'Evento: Aniversário', description: 'Participou do evento de aniversário (time)', category: 'event', icon: '🎉', hidden: false },

    { id: 'discord_hypesquad_bravery', name: 'HypeSquad Bravery', description: 'Badge do Discord', category: 'discord', icon: '🦁', hidden: false },
    { id: 'discord_hypesquad_brilliance', name: 'HypeSquad Brilliance', description: 'Badge do Discord', category: 'discord', icon: '🦉', hidden: false },
    { id: 'discord_hypesquad_balance', name: 'HypeSquad Balance', description: 'Badge do Discord', category: 'discord', icon: '🦄', hidden: false },
    { id: 'discord_nitro', name: 'Discord Nitro', description: 'Assinante Nitro', category: 'discord', icon: '🚀', hidden: false },
    { id: 'discord_nitro_early_supporter', name: 'Apoiador inicial', description: 'Nitro antes de 10/10/2018', category: 'discord', icon: '🏁', hidden: false },
    { id: 'discord_certified_moderator', name: 'Moderador certificado', description: 'Programa de moderação certificada', category: 'discord', icon: '🛡️', hidden: false },
    { id: 'discord_partner', name: 'Parceiro', description: 'Servidor parceiro (dono)', category: 'discord', icon: '🤝', hidden: false },
    { id: 'discord_verified_bot_dev', name: 'Dev de bot verificado', description: 'Desenvolvedor de bot verificado', category: 'discord', icon: '✅', hidden: false },
    { id: 'discord_active_dev', name: 'Active Developer', description: 'Desenvolvedor ativo', category: 'discord', icon: '🧩', hidden: false },
    { id: 'discord_hypesquad_events', name: 'HypeSquad Events', description: 'Membro HypeSquad Events', category: 'discord', icon: '🎟️', hidden: false },
    { id: 'discord_staff', name: 'Discord Staff', description: 'Funcionário do Discord', category: 'discord', icon: '👑', hidden: false },
  ] as const;

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { id: badge.id },
      update: {
        name: badge.name,
        description: badge.description,
        category: badge.category,
        icon: badge.icon,
        hidden: badge.hidden,
      },
      create: {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        icon: badge.icon,
        hidden: badge.hidden,
      },
    })
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(safe_error_details(err));

  try {
    await prisma.$disconnect();
  } finally {
    process.exit(1);
  }
});
