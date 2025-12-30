import { useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'

import { Button, Input, Textarea } from './ui'
import { validate_extended_template } from '../lib/message_template'

function parse_template_variants(template: string): { kind: 'single'; value: string } | { kind: 'list'; values: string[] } {
  const trimmed = template.trim()

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        return { kind: 'list', values: parsed }
      }
    } catch {
      // ignore
    }
  }

  return { kind: 'single', value: template }
}

function serialize_template_variants(values: string[]): string {
  return JSON.stringify(values)
}

type message_variant_editor_props = {
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  allow_json_template?: boolean
  disabled?: boolean
}

export function MessageVariantEditor({
  label,
  description,
  value,
  onChange,
  placeholder,
  rows = 4,
  allow_json_template = true,
  disabled,
}: message_variant_editor_props) {
  const parsed = useMemo(() => parse_template_variants(value), [value])

  const [new_value, set_new_value] = useState('')

  const variants = parsed.kind === 'list' ? parsed.values : null

  const [editing_index, set_editing_index] = useState<number | null>(null)
  const [editing_value, set_editing_value] = useState('')

  const variant_errors = useMemo(() => {
    if (!allow_json_template) return null
    if (!variants) return null

    const errors = variants.map((v) => (v.trim().length === 0 ? 'Mensagem vazia' : validate_extended_template(v) ?? null))

    return errors.some(Boolean) ? errors : null
  }, [allow_json_template, variants])

  const add_variant = () => {
    const trimmed = new_value.trim()
    if (!trimmed) return

    if (variants) {
      const next = [...variants, trimmed]
      onChange(serialize_template_variants(next))
    } else {
      // migrate single -> list
      const base = value.trim()
      const next = base.length > 0 ? [base, trimmed] : [trimmed]
      onChange(serialize_template_variants(next))
    }

    set_new_value('')
  }

  const remove_variant = (index: number) => {
    if (!variants) return

    const next = variants.slice()
    next.splice(index, 1)

    if (next.length === 0) {
      onChange('')
    } else if (next.length === 1) {
      onChange(next[0] ?? '')
    } else {
      onChange(serialize_template_variants(next))
    }

    if (editing_index === index) {
      set_editing_index(null)
      set_editing_value('')
    }
  }

  const start_edit = (index: number) => {
    if (!variants) return

    set_editing_index(index)
    set_editing_value(variants[index] ?? '')
  }

  const cancel_edit = () => {
    set_editing_index(null)
    set_editing_value('')
  }

  const save_edit = () => {
    if (!variants) return
    if (editing_index === null) return

    const trimmed = editing_value.trim()
    if (!trimmed) return

    const next = variants.slice()
    next[editing_index] = trimmed
    onChange(serialize_template_variants(next))

    set_editing_index(null)
    set_editing_value('')
  }

  const single_error = useMemo(() => {
    if (!allow_json_template) return null
    if (variants) return null

    if (!value.trim()) return null
    return validate_extended_template(value)
  }, [allow_json_template, value, variants])

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      {description && <div className="text-xs text-muted-foreground">{description}</div>}

      {!variants ? (
        <>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
          />
          {single_error && <div className="text-xs text-red-500">JSON inválido: {single_error}</div>}
        </>
      ) : (
        <div className="space-y-2">
          {variants.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-surface/40 px-4 py-4 text-center text-sm text-muted-foreground">
              Nenhuma mensagem adicionada
            </div>
          ) : (
            variants.map((v, index) => {
              const is_editing = editing_index === index
              const error = variant_errors ? variant_errors[index] : null

              return (
                <div key={index} className="rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">Mensagem {index + 1}</div>

                      {is_editing ? (
                        <Textarea
                          value={editing_value}
                          onChange={(e) => set_editing_value(e.target.value)}
                          rows={Math.max(3, rows)}
                          disabled={disabled}
                        />
                      ) : (
                        <pre className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                          {v}
                        </pre>
                      )}

                      {error && <div className="mt-2 text-xs text-red-500">JSON inválido: {error}</div>}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      {is_editing ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={save_edit}
                            disabled={disabled || !editing_value.trim()}
                            aria-label="Salvar mensagem"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancel_edit}
                            disabled={disabled}
                            aria-label="Cancelar edição"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => start_edit(index)}
                            disabled={disabled}
                            aria-label="Editar mensagem"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove_variant(index)}
                            disabled={disabled}
                            aria-label="Remover mensagem"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_44px]">
        <Input
          value={new_value}
          onChange={(e) => set_new_value(e.target.value)}
          placeholder="Adicionar nova mensagem..."
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add_variant()
            }
          }}
        />
        <Button
          variant="outline"
          onClick={add_variant}
          className="px-0"
          disabled={disabled || !new_value.trim()}
          aria-label="Adicionar mensagem"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Dica: quando você adiciona mais de uma mensagem, o bot escolhe uma aleatória a cada evento.
      </div>
    </div>
  )
}
