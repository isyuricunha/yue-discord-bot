import { Link } from 'react-router-dom'


type faq_item_props = {
  question: string
  children: React.ReactNode
}

export function BackLink() {
  return (
    <Link
      to="/extras"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <span aria-hidden="true">←</span> Voltar para Extras
    </Link>
  )
}

export function faq_item(props: faq_item_props) {
  return (
    <details className="group rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:hidden">
        {props.question}
      </summary>
      <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">{props.children}</div>
    </details>
  )
}

export function section_title(props: { children: React.ReactNode; description?: string }) {
  return (
    <div>
      <div className="text-base font-semibold">{props.children}</div>
      {props.description && <div className="mt-1 text-sm text-muted-foreground">{props.description}</div>}
    </div>
  )
}
