import React from 'react'
import { Save, AlertTriangle } from 'lucide-react'

import { Badge, Button } from '../ui'
import { Breadcrumb, generateBreadcrumbs } from './Breadcrumb'

interface PageLayoutProps {
  title: string
  description?: string
  children: React.ReactNode
  breadcrumbs?: React.ComponentProps<typeof Breadcrumb>['items']
  actions?: React.ReactNode
  hasChanges?: boolean
  isSaving?: boolean
  onSave?: () => void
  saveDisabled?: boolean
  error?: string
  loading?: boolean
}

export function PageLayout({
  title,
  description,
  children,
  breadcrumbs,
  actions,
  hasChanges,
  isSaving,
  onSave,
  saveDisabled,
  error,
  loading,
}: PageLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          {/* Breadcrumb */}
          {breadcrumbs && (
            <Breadcrumb items={breadcrumbs} className="mb-2" />
          )}
          
          {/* Title and Description */}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {actions}
          
          {hasChanges !== undefined && (
            <Badge variant={hasChanges ? 'accent' : 'neutral'}>
              {hasChanges ? 'Alterações pendentes' : 'Salvo'}
            </Badge>
          )}
          
          {onSave && (
            <Button
              onClick={onSave}
              isLoading={isSaving}
              disabled={saveDisabled || isSaving || !hasChanges}
              className="shrink-0"
            >
              <Save className="h-4 w-4" />
              <span>Salvar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive">Erro</h3>
              <p className="mt-1 text-sm text-destructive-foreground">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Carregando...</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && (
        <main className="space-y-6">
          {children}
        </main>
      )}
    </div>
  )
}

// Helper component for consistent card sections
interface PageSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function PageSection({ title, description, children, className }: PageSectionProps) {
  return (
    <div className={`rounded-xl border border-border/80 bg-background/95 backdrop-blur-sm p-6 ${className || ''}`}>
      {title && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}

// Hook to generate breadcrumbs automatically from current route
export function useAutoBreadcrumbs() {
  const location = typeof window !== 'undefined' ? window.location.pathname : ''
  return generateBreadcrumbs(location)
}
