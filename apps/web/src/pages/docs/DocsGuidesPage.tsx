import { CodeInline } from './docs_shared'

type guide = {
  id: string
  title: string
  intro: string
  bullets: Array<{ label: string; text: string; commands?: string[] }>
  commands: string[]
}

const guides: guide[] = [
  {
    id: 'xp',
    title: 'XP e níveis',
    intro:
      'Membros ganham XP participando do servidor. A cada nível, a Yue anuncia a evolução (se estiver configurada) e o prestígio dá recomeços com status especial.',
    bullets: [
      { label: 'Ver seu progresso', text: '/rank mostra seu nível, XP e posição no servidor.' },
      { label: 'Ranking do servidor', text: '/leaderboard lista os membros mais ativos.' },
      { label: 'Subir de nível', text: '/nivel mostra e adjusta opções de anúncio de nível.' },
      { label: 'Prestígio', text: '/prestige reseta seu nível em troca de prestígio acumulado.' },
      { label: 'Presentear XP', text: '/transferir transfere XP seu para outro membro.' },
    ],
    commands: ['rank', 'leaderboard', 'nivel', 'prestige', 'transferir'],
  },
  {
    id: 'economia',
    title: 'Economia (luazinhas)',
    intro:
      'As luazinhas são a moeda da comunidade. Elas vêm da recompensa diária e de interações, e são gastas na loja ou em apostas.',
    bullets: [
      { label: 'Carteira e banco', text: '/luazinhas mostra seu saldo; /banco deposita e protege.' },
      { label: 'Recompensa diária', text: '/diario resgata luazinhas uma vez por dia.' },
      { label: 'Loja', text: '/loja lista itens disponíveis; /inventario mostra o que você tem.' },
    ],
    commands: ['luazinhas', 'diario', 'loja', 'inventario', 'banco'],
  },
  {
    id: 'musica',
    title: 'Música',
    intro:
      'A Yue toca música no canal de voz via Lavalink: YouTube, Spotify (por link) e playlists, com fila compartilhada.',
    bullets: [
      { label: 'Tocar', text: '/play aceita nome ou link e entra no seu canal de voz.' },
      { label: 'Fila', text: '/queue mostra o que vem depois; /playlist gerencia playlists salvas.' },
      { label: 'Controles', text: '/skip pula, /stop para tudo, /nowplaying mostra o que está tocando, /volume ajusta.' },
      { label: 'Modo DJ', text: '/dj configura quem pode controlar o player (cargo de DJ).' },
    ],
    commands: ['play', 'skip', 'stop', 'volume', 'queue', 'playlist', 'nowplaying', 'dj'],
  },
  {
    id: 'sorteios',
    title: 'Sorteios',
    intro:
      'Do sorteio relâmpago ao sorteio com wizard: defino prêmio, duração e número de vencedores, e a Yue cuida do resto.',
    bullets: [
      { label: 'Sorteio rápido', text: '/sorteio cria direto com prêmio e duração.' },
      { label: 'Assistente', text: '/sorteio-wizard te guia passo a passo nas opções avançadas.' },
      { label: 'Acompanhar', text: '/sorteio-lista lista os sorteios ativos e encerrados do servidor.' },
    ],
    commands: ['sorteio', 'sorteio-wizard', 'sorteio-lista'],
  },
  {
    id: 'tickets',
    title: 'Tickets',
    intro:
      'Tickets criam um canal privado entre o membro e a equipe, ideal para suporte, denúncias e dúvidas que não devem ficar públicas.',
    bullets: [
      { label: 'Abrir', text: '/ticket abre um atendimento; a equipe vê no painel e no canal configurado.' },
      { label: 'Painel de tickets', text: 'Ative o painel público de tickets na configuração do servidor.' },
    ],
    commands: ['ticket'],
  },
  {
    id: 'waifu',
    title: 'Waifu e casamento',
    intro:
      'O lado divertido: rolls de waifu/husbando, pontos, desejo e um sistema completo de casamento entre membros.',
    bullets: [
      { label: 'Rolls', text: '/waifu e /husbando sorteiam personagens; /desejo guarda o que você quer.' },
      { label: 'Coleção', text: '/meuharem e /harem mostram sua coleção; /wishlist lista desejos.' },
      { label: 'Casamento', text: '/casar (ou /marry) pede alguém em casamento; /infocasamento mostra o status.' },
      { label: 'Pontos', text: '/waifupontos mostra seus pontos de desejo; /ranking mostra o top da comunidade.' },
    ],
    commands: [
      'waifu', 'husbando', 'casar', 'marry', 'divorciar', 'divorce',
      'infocasamento', 'desejos', 'waifupontos', 'wishlist', 'meuharem', 'harem', 'reroll', 'ranking',
    ],
  },
  {
    id: 'moderacao',
    title: 'Moderação',
    intro:
      'Ferramentas para a equipe: ações registram no modlog, avisos acumulam e o antiraid segura entrada em massa.',
    bullets: [
      { label: 'Ações', text: '/ban, /kick, /mute e /warn aplicam; /unwarn e /unmute revertem.' },
      { label: 'Histórico', text: '/modlog lista as ações de um membro; /baninfo detalha um banimento.' },
      { label: 'Limpeza', text: '/limpar apaga mensagens em massa no canal atual.' },
      { label: 'Antiraid', text: '/antiraide configura proteção contra entrada em massa.' },
    ],
    commands: [
      'ban', 'kick', 'mute', 'unmute', 'warn', 'unwarn', 'modlog', 'baninfo',
      'antiraide', 'limpar', 'lock', 'unlock',
    ],
  },
  {
    id: 'painel',
    title: 'Painel web e IA',
    intro:
      'Quase tudo no Discord tem um equivalente no painel web: configure o servidor, modere, gerencie economia, badges e tickets, e converse com a IA do painel, que entende os dados do seu servidor.',
    bullets: [
      { label: 'Abrir o painel', text: '/painel gera o link; o login é com sua conta do Discord.' },
      { label: 'Configuração rápida', text: '/config ajusta o essencial direto no Discord.' },
      { label: 'IA do painel', text: 'No painel, converse com a assistente para configurar e entender seus dados.' },
    ],
    commands: ['painel', 'config'],
  },
]

export default function DocsGuidesPage() {
  return (
    <div className="space-y-8">
      {guides.map((guide) => (
        <section key={guide.id} id={guide.id} className="scroll-mt-20 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">{guide.title}</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{guide.intro}</p>
          <ul className="space-y-2">
            {guide.bullets.map((bullet) => (
              <li key={bullet.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="font-medium text-foreground">{bullet.label}:</span>
                <span className="text-muted-foreground">{bullet.text}</span>
                {bullet.commands && bullet.commands.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {bullet.commands.map((command) => (
                      <CodeInline key={command}>/{command}</CodeInline>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5">
            {guide.commands.map((command) => (
              <a
                key={command}
                href={`/docs/comandos?categoria=${guide.id === 'waifu' ? 'waifu' : guide.id}`}
                className="rounded-full border border-border/70 bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                /{command}
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
