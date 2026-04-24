/**
 * Componente GuildModuleCard para exibir cards de módulos da guild
 *
 * @param {Object} props - Props do componente
 * @param {ModuleCard} props.item - Dados do módulo
 * @param {function} props.onClick - Função a ser chamada ao clicar
 * @returns {JSX.Element} Card do módulo com ícone, label e descrição
 */

import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../../../components/ui'
import type { ModuleCard } from '../types'

export function GuildModuleCard({ item }: { item: ModuleCard }) {
    const navigate = useNavigate()

    return (
        <Card
            key={item.to}
            className="group cursor-pointer transition-all hover:border-accent/40 hover:shadow-sm"
            onClick={() => navigate(item.to)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(item.to)
                }
            }}
            aria-label={`Acessar ${item.label} - ${item.description}`}
        >
            <CardContent className="p-5">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent transition-colors group-hover:bg-accent/10">
                        {item.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold group-hover:text-accent transition-colors">
                            {item.label}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}