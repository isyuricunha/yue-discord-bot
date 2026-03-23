import {
  Trash2,
  Edit3,
  MessageSquare,
  Shield,
  Plus,
  Settings,
  UserPlus,
  UserMinus,
  FileText,
  User,
  Hash
} from 'lucide-react'
import { Badge, Tooltip } from '../../components/ui'

import type { audit_row } from '../AuditLogs'

function format_ts_iso(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR')
}

export function AuditLogItem({ log }: { log: audit_row }) {
  const formatAction = (action: string) => {
    switch (action) {
      case 'message_delete': return { label: 'Mensagem Apagada', icon: <Trash2 className="h-4 w-4 text-red-500" />, color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/20' }
      case 'message_update': return { label: 'Mensagem Editada', icon: <Edit3 className="h-4 w-4 text-blue-500" />, color: 'text-blue-400', bg: 'bg-blue-500/5', border: 'border-blue-500/20' }
      case 'channel_create': return { label: 'Canal Criado', icon: <Plus className="h-4 w-4 text-green-500" />, color: 'text-green-400', bg: 'bg-green-500/5', border: 'border-green-500/20' }
      case 'channel_delete': return { label: 'Canal Apagado', icon: <Trash2 className="h-4 w-4 text-red-500" />, color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/20' }
      case 'member_roles_update': return { label: 'Cargos Atualizados', icon: <Shield className="h-4 w-4 text-yellow-500" />, color: 'text-yellow-400', bg: 'bg-yellow-500/5', border: 'border-yellow-500/20' }
      case 'member_join': return { label: 'Membro Entrou', icon: <UserPlus className="h-4 w-4 text-green-500" />, color: 'text-green-400', bg: 'bg-green-500/5', border: 'border-green-500/20' }
      case 'member_leave': return { label: 'Membro Saiu', icon: <UserMinus className="h-4 w-4 text-red-500" />, color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/20' }
      case 'guild_update': return { label: 'Servidor Atualizado', icon: <Settings className="h-4 w-4 text-purple-500" />, color: 'text-purple-400', bg: 'bg-purple-500/5', border: 'border-purple-500/20' }
      default: return { label: action, icon: <FileText className="h-4 w-4 text-muted-foreground" />, color: 'text-foreground', bg: 'bg-surface/40', border: 'border-border/70' }
    }
  }

  const act = formatAction(log.action)
  const data = log.data as any

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 transition-all duration-300 hover:shadow-lg ${act.bg} ${act.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${act.border} bg-background/50 shadow-sm backdrop-blur-sm`}>
              {act.icon}
            </div>
            <div className={`truncate text-sm sm:text-base font-semibold ${act.color}`}>{act.label}</div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground/80 font-medium pl-0 sm:pl-[42px]">{format_ts_iso(log.createdAt)}</div>
        </div>
        <div className="text-right flex items-center h-8">
          <Tooltip content={`ID: ${log.id}`}>
            <div className="text-[10px] font-mono text-muted-foreground/40 cursor-help hover:text-muted-foreground transition-colors">#{log.id.slice(-8)}</div>
          </Tooltip>
        </div>
      </div>

      <div className="mt-4 pl-0 sm:pl-[42px] flex flex-wrap gap-2 text-xs">
        {log.actorUserId && (
          <Badge className="bg-background/80 border-border/50 text-muted-foreground backdrop-blur-sm font-medium py-1">
            <User className="mr-1.5 h-3 w-3" />
            <span className="opacity-70 mr-1">Autor:</span> <span className="font-mono text-[10px]">{log.actorUserId}</span>
          </Badge>
        )}
        {log.targetUserId && (
          <Badge className="bg-background/80 border-border/50 text-muted-foreground backdrop-blur-sm font-medium py-1">
            <User className="mr-1.5 h-3 w-3" />
            <span className="opacity-70 mr-1">Alvo:</span> <span className="font-mono text-[10px]">{log.targetUserId}</span>
          </Badge>
        )}
        {log.targetChannelId && (
          <Badge className="bg-background/80 border-border/50 text-muted-foreground backdrop-blur-sm font-medium py-1">
            <Hash className="mr-1.5 h-3 w-3" />
            <span className="opacity-70 mr-1">Canal:</span> <span className="font-mono text-[10px]">{log.targetChannelId}</span>
          </Badge>
        )}
      </div>

      <div className="mt-4 pl-0 sm:pl-[42px]">
        {log.action === 'message_delete' && data ? (
          <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-3.5 w-3.5 text-red-400/70" />
              <span className="text-xs font-semibold text-red-400/90 tracking-wide uppercase">Mensagem Deletada</span>
            </div>
            {data.authorTag && <div className="text-[11px] text-muted-foreground/80 mb-2">De: <span className="font-semibold text-foreground/80">{data.authorTag}</span></div>}
            <div className="text-sm text-foreground/90 italic break-words bg-background/50 p-3 rounded-lg border border-red-500/10">
              {data.content || <span className="opacity-50">(Sem conteúdo em texto)</span>}
            </div>
          </div>
        ) : log.action === 'message_update' && data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-surface/50 p-3.5 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Previamente</div>
              <div className="text-sm text-foreground/80 italic break-words line-through decoration-red-500/30 bg-background/40 p-3 rounded-lg border border-border/40">
                {data.oldContent || <span className="opacity-50">(Vazio)</span>}
              </div>
            </div>
            <div className="rounded-xl border border-blue-500/10 bg-blue-500/5 p-3.5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400/90 mb-2 relative z-10">Atualmente</div>
              <div className="text-sm text-foreground/90 break-words bg-background/60 p-3 rounded-lg border border-blue-500/20 relative z-10">
                {data.newContent || <span className="opacity-50">(Vazio)</span>}
              </div>
              {data.authorTag && <div className="mt-2.5 text-[11px] text-muted-foreground/80 font-medium relative z-10">Editado por: <span className="text-foreground/80">{data.authorTag}</span></div>}
            </div>
          </div>
        ) : log.action === 'member_roles_update' && data ? (
          <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/5 p-3.5 shadow-sm">
            {Array.isArray(data.addedRoleIds) && data.addedRoleIds.length > 0 && (
              <div className={Array.isArray(data.removedRoleIds) && data.removedRoleIds.length > 0 ? "mb-3" : ""}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-green-400/80 mb-2">Cargos Adicionados</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.addedRoleIds.map((r: string) => (
                    <Badge key={r} className="bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors py-0.5">
                      <Shield className="mr-1.5 h-3 w-3 opacity-70" />
                      ID: {r}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(data.removedRoleIds) && data.removedRoleIds.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-400/80 mb-2">Cargos Removidos</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.removedRoleIds.map((r: string) => (
                    <Badge key={r} className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors py-0.5">
                      <Shield className="mr-1.5 h-3 w-3 opacity-70" />
                      ID: {r}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : log.action === 'channel_create' && data ? (
          <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="h-3.5 w-3.5 text-green-400/70" />
              <span className="text-xs font-semibold text-green-400/90 tracking-wide uppercase">Detalhes do Canal</span>
            </div>
            <div className="bg-background/50 p-3 rounded-lg border border-green-500/10 space-y-1.5">
              {data.name && <div className="text-[13px] text-foreground/80">Nome: <span className="font-semibold text-foreground ml-1">#{data.name}</span></div>}
              {data.type !== undefined && <div className="text-xs text-muted-foreground/80">Tipo: <span className="font-mono text-[10px] bg-background/80 px-1.5 py-0.5 rounded border border-border/50 ml-1">{data.type}</span></div>}
            </div>
          </div>
        ) : data && Object.keys(data).length > 0 ? (
          <details className="group [&_summary::-webkit-details-marker]:hidden">
             <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">
               <Settings className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
               Ver detalhes técnicos (Avançado)
             </summary>
             <pre className="mt-3 overflow-x-auto whitespace-pre-wrap wrap-break-word rounded-xl border border-border/40 bg-black/20 p-4 text-[11px] font-mono text-muted-foreground shadow-inner">
               {JSON.stringify(data, null, 2)}
             </pre>
          </details>
        ) : null}
      </div>
    </div>
  )
}
