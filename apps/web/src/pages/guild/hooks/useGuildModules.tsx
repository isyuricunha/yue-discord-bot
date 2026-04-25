import { useMemo } from 'react'
import {
    BarChart3,
    Shield,
    Gavel,
    Siren,
    Trophy,
    Gamepad2,
    FileText,
    Users,
    Settings,
    Sparkles,
    Hand,
    UserPlus,
    LifeBuoy,
    Lightbulb,
    Zap,
    MousePointerClick,
    Star,
    TerminalSquare,
    Command,
    ClipboardList,
    Music,
    TrendingUp,
} from 'lucide-react'
import type { ModuleCard, ModuleCategory } from '../types'

const category_labels: Record<ModuleCategory, string> = {
    essentials: 'Primeiros passos',
    automation: 'Automação',
    engagement: 'Engajamento',
    support: 'Suporte',
    admin: 'Administração',
}

const category_order: ModuleCategory[] = ['essentials', 'automation', 'engagement', 'support', 'admin']

export interface UseGuildModulesResult {
    modules: ModuleCard[]
    groupedModules: Record<ModuleCategory, ModuleCard[]>
    categoryLabels: Record<ModuleCategory, string>
    categoryOrder: ModuleCategory[]
}

export function useGuildModules(guildId: string): UseGuildModulesResult {
    const modules = useMemo<ModuleCard[]>(() => {
        return [
            {
                to: `/guild/${guildId}/setup`,
                label: 'Setup Wizard',
                description: 'Configuração guiada inicial',
                icon: <Sparkles className="h-5 w-5" />,
                category: 'essentials',
            },
            {
                to: `/guild/${guildId}/overview`,
                label: 'Visão geral',
                description: 'Estatísticas e resumo',
                icon: <BarChart3 className="h-5 w-5" />,
                category: 'essentials',
            },
            {
                to: `/guild/${guildId}/commands`,
                label: 'Comandos',
                description: 'Lista do que o bot oferece',
                icon: <TerminalSquare className="h-5 w-5" />,
                category: 'essentials',
            },
            {
                to: `/guild/${guildId}/automod`,
                label: 'AutoMod',
                description: 'Moderação automática',
                icon: <Shield className="h-5 w-5" />,
                category: 'automation',
            },
            {
                to: `/guild/${guildId}/moderation`,
                label: 'Moderação',
                description: 'Punições e automação',
                icon: <Gavel className="h-5 w-5" />,
                category: 'automation',
            },
            {
                to: `/guild/${guildId}/welcome`,
                label: 'Boas-vindas',
                description: 'Mensagens automáticas',
                icon: <Hand className="h-5 w-5" />,
                category: 'automation',
            },
            {
                to: `/guild/${guildId}/autorole`,
                label: 'Autorole',
                description: 'Cargos para novos membros',
                icon: <UserPlus className="h-5 w-5" />,
                category: 'automation',
            },
            {
                to: `/guild/${guildId}/xp`,
                label: 'XP & Níveis',
                description: 'Sistema de ranking',
                icon: <TrendingUp className="h-5 w-5" />,
                category: 'engagement',
            },
            {
                to: `/guild/${guildId}/reaction-roles`,
                label: 'Reaction Roles',
                description: 'Painéis de cargos',
                icon: <MousePointerClick className="h-5 w-5" />,
                category: 'engagement',
            },
            {
                to: `/guild/${guildId}/starboard`,
                label: 'Starboard',
                description: 'Destaque mensagens',
                icon: <Star className="h-5 w-5" />,
                category: 'engagement',
            },
            {
                to: `/guild/${guildId}/suggestions`,
                label: 'Sugestões',
                description: 'Canal de ideias',
                icon: <Lightbulb className="h-5 w-5" />,
                category: 'engagement',
            },
            {
                to: `/guild/${guildId}/custom-commands`,
                label: 'Custom Commands',
                description: 'Comandos personalizados',
                icon: <Command className="h-5 w-5" />,
                category: 'engagement',
            },
            {
                to: `/guild/${guildId}/antiraid`,
                label: 'Anti-Raide',
                description: 'Proteção contra raids e moderação avançada',
                icon: <Siren className="h-5 w-5" />,
                category: 'engagement',
            },
            {
                to: `/guild/${guildId}/free-games`,
                label: 'Jogos Grátis',
                description: 'Games gratuitos para membros',
                icon: <Gamepad2 className="h-5 w-5" />,
                category: 'engagement',
            },
            {
                to: `/guild/${guildId}/triggers`,
                label: 'Gatilhos',
                description: 'Automação de mensagens e reações',
                icon: <Zap className="h-5 w-5" />,
                category: 'engagement',
            },
            {
                to: `/guild/${guildId}/music`,
                label: 'Música',
                description: 'Player e playlists',
                icon: <Music className="h-5 w-5" />,
                category: 'engagement',
            },
            {
                to: `/guild/${guildId}/tickets`,
                label: 'Tickets',
                description: 'Suporte e painel',
                icon: <LifeBuoy className="h-5 w-5" />,
                category: 'support',
            },
            {
                to: `/guild/${guildId}/members`,
                label: 'Membros',
                description: 'Gerenciar usuários',
                icon: <Users className="h-5 w-5" />,
                category: 'admin',
            },
            {
                to: `/guild/${guildId}/giveaways`,
                label: 'Sorteios',
                description: 'Criar e gerenciar',
                icon: <Trophy className="h-5 w-5" />,
                category: 'admin',
            },
            {
                to: `/guild/${guildId}/settings`,
                label: 'Configurações',
                description: 'Preferências gerais',
                icon: <Settings className="h-5 w-5" />,
                category: 'admin',
            },
            {
                to: `/guild/${guildId}/modlogs`,
                label: 'Logs',
                description: 'Histórico de ações',
                icon: <FileText className="h-5 w-5" />,
                category: 'admin',
            },
            {
                to: `/guild/${guildId}/audit`,
                label: 'Audit',
                description: 'Eventos importantes',
                icon: <ClipboardList className="h-5 w-5" />,
                category: 'admin',
            },
        ]
    }, [guildId])

    const groupedModules = useMemo(() => {
        const grouped: Record<ModuleCategory, ModuleCard[]> = {
            essentials: [],
            automation: [],
            engagement: [],
            support: [],
            admin: [],
        }
        for (const cat of category_order) {
            grouped[cat] = modules.filter((m: ModuleCard) => m.category === cat)
        }
        return grouped
    }, [modules])

    return {
        modules,
        groupedModules,
        categoryLabels: category_labels,
        categoryOrder: category_order,
    }
}
