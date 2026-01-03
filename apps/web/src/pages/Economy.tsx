import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowRightLeft, Coins, Shield } from 'lucide-react'

import { getApiUrl } from '../env'
import { Button, Card, CardContent, CardHeader, EmptyState, ErrorState, Input, Skeleton } from '../components/ui'
import { toast_error, toast_success } from '../store/toast'
import { useAuthStore } from '../store/auth'
import { format_luazinhas } from '../lib/luazinhas'

const API_URL = getApiUrl()

type tx_row = {
  id: string
  type: string
  amount: string
  fromUserId: string | null
  toUserId: string | null
  guildId: string | null
  reason: string | null
  metadata: unknown
  createdAt: string
}

export default function EconomyPage() {
  const { user } = useAuthStore()

  const [transfer_to, set_transfer_to] = useState('')
  const [transfer_amount, set_transfer_amount] = useState('')
  const [transfer_reason, set_transfer_reason] = useState('')
  const [is_transfer_loading, set_is_transfer_loading] = useState(false)

  const [admin_user_id, set_admin_user_id] = useState('')
  const [admin_amount, set_admin_amount] = useState('')
  const [admin_reason, set_admin_reason] = useState('')
  const [is_admin_loading, set_is_admin_loading] = useState(false)

  const {
    data: me,
    isLoading: is_me_loading,
    isError: is_me_error,
    refetch: refetch_me,
  } = useQuery({
    queryKey: ['economy', 'me'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/economy/me`)
      return res.data as { success: boolean; balance: string }
    },
  })

  const {
    data: tx_data,
    isLoading: is_tx_loading,
    isError: is_tx_error,
    refetch: refetch_txs,
  } = useQuery({
    queryKey: ['economy', 'transactions'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/economy/transactions`, { params: { limit: 50, offset: 0 } })
      return res.data as { success: boolean; transactions: tx_row[]; total: number }
    },
  })

  const balance_label = useMemo(() => {
    return format_luazinhas(me?.balance ?? '0')
  }, [me?.balance])

  const do_transfer = async () => {
    set_is_transfer_loading(true)
    try {
      const payload = {
        toUserId: transfer_to.trim(),
        amount: transfer_amount.trim(),
        reason: transfer_reason.trim() || undefined,
      }

      await axios.post(`${API_URL}/api/economy/transfer`, payload)
      toast_success('Transferência realizada!')
      set_transfer_amount('')
      set_transfer_reason('')
      await Promise.all([refetch_me(), refetch_txs()])
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao transferir'
      toast_error(msg)
    } finally {
      set_is_transfer_loading(false)
    }
  }

  const do_admin_adjust = async (mode: 'add' | 'remove') => {
    set_is_admin_loading(true)
    try {
      const payload = {
        userId: admin_user_id.trim(),
        amount: admin_amount.trim(),
        reason: admin_reason.trim() || undefined,
      }

      await axios.post(`${API_URL}/api/economy/admin/${mode}`, payload)
      toast_success(mode === 'add' ? 'Saldo adicionado!' : 'Saldo removido!')
      set_admin_amount('')
      set_admin_reason('')
      await Promise.all([refetch_me(), refetch_txs()])
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao ajustar saldo'
      toast_error(msg)
    } finally {
      set_is_admin_loading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Economia</div>
          <div className="mt-1 text-sm text-muted-foreground">Saldo e transações (luazinhas)</div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-10"
          onClick={() => {
            void refetch_me()
            void refetch_txs()
          }}
        >
          Atualizar
        </Button>

        <Card className="min-w-[220px]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border/80 bg-surface/60 text-accent">
                <Coins className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs text-muted-foreground">Seu saldo</div>
                <div className="text-lg font-semibold">
                  {is_me_loading ? <Skeleton className="h-5 w-24" /> : `${balance_label} luazinhas`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(is_me_error || is_tx_error) && (
        <ErrorState
          title="Não foi possível carregar a economia"
          description="Falha ao buscar saldo e/ou histórico."
          onAction={() => {
            void refetch_me()
            void refetch_txs()
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-accent" />
              <div className="text-sm font-semibold">Transferir</div>
            </div>
            <div className="text-xs text-muted-foreground">Envia luazinhas para outro usuário (por ID)</div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Discord user id" value={transfer_to} onChange={(e) => set_transfer_to(e.target.value)} />
            <Input placeholder="Quantia" value={transfer_amount} onChange={(e) => set_transfer_amount(e.target.value)} />
            <Input placeholder="Motivo (opcional)" value={transfer_reason} onChange={(e) => set_transfer_reason(e.target.value)} />
            <Button className="w-full" isLoading={is_transfer_loading} onClick={() => void do_transfer()} disabled={!transfer_to.trim() || !transfer_amount.trim()}>
              Transferir
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <div className="text-sm font-semibold">Admin</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Ajustes globais (apenas allowlist). Você: {user?.isOwner ? 'owner' : 'normal'}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Usuário (ID)" value={admin_user_id} onChange={(e) => set_admin_user_id(e.target.value)} />
            <Input placeholder="Quantia" value={admin_amount} onChange={(e) => set_admin_amount(e.target.value)} />
            <Input placeholder="Motivo (opcional)" value={admin_reason} onChange={(e) => set_admin_reason(e.target.value)} />

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                isLoading={is_admin_loading}
                disabled={!admin_user_id.trim() || !admin_amount.trim()}
                onClick={() => void do_admin_adjust('add')}
              >
                Adicionar
              </Button>
              <Button
                variant="outline"
                isLoading={is_admin_loading}
                disabled={!admin_user_id.trim() || !admin_amount.trim()}
                onClick={() => void do_admin_adjust('remove')}
              >
                Remover
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <div className="text-sm font-semibold">Transações recentes</div>
          <div className="text-xs text-muted-foreground">Últimas 50 movimentações</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {is_tx_loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : tx_data?.transactions?.length ? (
            <div className="space-y-2">
              {tx_data.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-surface/40 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{tx.type}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {tx.fromUserId ? `from ${tx.fromUserId}` : ''}
                      {tx.toUserId ? ` to ${tx.toUserId}` : ''}
                      {tx.guildId ? ` • guild ${tx.guildId}` : ''}
                      {tx.reason ? ` • ${tx.reason}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold">{format_luazinhas(tx.amount)} </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma transação" description="Ainda não há movimentações para exibir." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
