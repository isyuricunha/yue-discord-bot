import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent } from '../../components/ui'

type chart_point = {
  date: string
  newMembers: number
  moderationActions: number
  economy: number
}

type props = {
  data: chart_point[]
}

export default function OverviewCharts({ data }: props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 text-sm font-medium">Ingresso de Membros (7 dias)</div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--cursor-accent-navy)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--cursor-accent-navy)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--yu-border-default)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--cursor-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--cursor-text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--cursor-bg-popover)', borderColor: 'var(--yu-border-default)', borderRadius: 'var(--yu-radius-popover)', boxShadow: 'var(--cursor-floating-shadow)' }}
                  itemStyle={{ color: 'var(--cursor-text-primary)' }}
                />
                <Area type="monotone" dataKey="newMembers" name="Novos Membros" stroke="var(--cursor-accent-navy)" fillOpacity={1} fill="url(#colorMembers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 text-sm font-medium">Economia & Moderação (7 dias)</div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEcon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--cursor-accent-yellow)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--cursor-accent-yellow)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMod" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--cursor-accent-red)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--cursor-accent-red)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--yu-border-default)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--cursor-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--cursor-text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--cursor-bg-popover)', borderColor: 'var(--yu-border-default)', borderRadius: 'var(--yu-radius-popover)', boxShadow: 'var(--cursor-floating-shadow)' }}
                  itemStyle={{ color: 'var(--cursor-text-primary)' }}
                />
                <Area type="monotone" dataKey="economy" name="Transações Globais" stroke="var(--cursor-accent-yellow)" fillOpacity={1} fill="url(#colorEcon)" />
                <Area type="monotone" dataKey="moderationActions" name="Ações de Mod." stroke="var(--cursor-accent-red)" fillOpacity={1} fill="url(#colorMod)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
