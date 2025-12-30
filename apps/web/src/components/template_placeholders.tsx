import type { template_placeholder } from '@yuebot/shared/template_placeholders'

type placeholder_chips_props = {
  placeholders: template_placeholder[]
}

export function PlaceholderChips(props: placeholder_chips_props) {
  return (
    <div className="mt-1 flex flex-wrap gap-2 text-xs">
      {props.placeholders.map((p) => (
        <span key={p.key} className="rounded-lg border border-border/70 bg-surface/70 px-2 py-1 font-mono text-foreground">
          {p.token}
        </span>
      ))}
    </div>
  )
}

type placeholder_inline_list_props = {
  placeholders: template_placeholder[]
}

export function PlaceholderInlineList(props: placeholder_inline_list_props) {
  return (
    <>
      {props.placeholders.map((p, index) => (
        <span key={p.key}>
          <span className="ml-1 font-mono text-foreground">{p.token}</span>
          {p.description ? <span className="ml-1">({p.description})</span> : null}
          {index < props.placeholders.length - 1 ? ',' : '.'}
        </span>
      ))}
    </>
  )
}
