import type { Components } from 'react-markdown'
import { Check, Copy, X } from 'lucide-react'
import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

import { cn } from '../../lib/cn'

type PanelAssistantMarkdownProps = {
  children: string
}

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:']

type safe_link = { href: string; external: boolean }

function getSafeLink(url: string): safe_link | null {
  if (
    (url.startsWith('/') && !url.startsWith('//')) ||
    url.startsWith('./') ||
    url.startsWith('../') ||
    url.startsWith('#')
  ) {
    return { href: url, external: false }
  }
  try {
    const parsed = new URL(url)
    if (!SAFE_PROTOCOLS.includes(parsed.protocol)) return null
    return { href: url, external: parsed.protocol === 'http:' || parsed.protocol === 'https:' }
  } catch {
    return null
  }
}

function CodeBlock({ children }: React.ComponentPropsWithoutRef<'pre'>) {
  const [copyState, setCopyState] = React.useState<'idle' | 'success' | 'failure'>('idle')
  const codeElement = React.Children.toArray(children).find(React.isValidElement)
  const codeProps = React.isValidElement<{ className?: string; children?: React.ReactNode }>(codeElement)
    ? codeElement.props
    : null
  const language = codeProps?.className?.match(/(?:^|\s)language-([^\s]+)/)?.[1]
  const code = React.Children.toArray(codeProps?.children)
    .map((child) => typeof child === 'string' || typeof child === 'number' ? String(child) : '')
    .join('')
    .replace(/\n$/, '')

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopyState('success')
    } catch {
      setCopyState('failure')
    }
  }, [code])

  const copyLabel = copyState === 'success'
    ? 'Código copiado'
    : copyState === 'failure'
      ? 'Falha ao copiar código; tentar novamente'
      : 'Copiar código'

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-yue-code-border bg-yue-code-block-bg">
      <div className="flex min-h-8 items-center justify-between gap-3 border-b border-yue-code-border px-3 py-1">
        <span className="text-[11px] text-muted-foreground">{language ?? 'Código'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copyLabel}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors',
            'hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35'
          )}
        >
          {copyState === 'success' ? <Check className="h-3.5 w-3.5" /> : copyState === 'failure' ? <X className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copyState === 'success' ? 'Copiado' : copyState === 'failure' ? 'Tentar novamente' : 'Copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm"><code className={codeProps?.className}>{code}</code></pre>
    </div>
  )
}

const components: Partial<Components> = {
  // Headings — keep them modest inside chat context
  h1: ({ children, ...rest }) => (
    <h1 className="mt-3 mb-1.5 text-lg font-semibold text-strong" {...rest}>
      {children}
    </h1>
  ),
  h2: ({ children, ...rest }) => (
    <h2 className="mt-2.5 mb-1 text-base font-semibold text-strong" {...rest}>
      {children}
    </h2>
  ),
  h3: ({ children, ...rest }) => (
    <h3 className="mt-2 mb-1 text-sm font-semibold text-strong" {...rest}>
      {children}
    </h3>
  ),
  p: ({ children, ...rest }) => (
    <p className="mb-2 leading-relaxed text-foreground" {...rest}>
      {children}
    </p>
  ),
  ul: ({ children, ...rest }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5 text-foreground" {...rest}>
      {children}
    </ul>
  ),
  ol: ({ children, ...rest }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-foreground" {...rest}>
      {children}
    </ol>
  ),
  li: ({ children, ...rest }) => (
    <li className="leading-relaxed" {...rest}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...rest }) => (
    <blockquote className="my-2 border-l-2 border-yue-blockquote-border bg-yue-blockquote-bg pl-3 text-yue-blockquote-text" {...rest}>
      {children}
    </blockquote>
  ),
  pre: CodeBlock,
  code: ({ children, ...rest }) => (
    <code className="rounded border border-yue-code-border bg-yue-code-inline-bg px-1.5 py-0.5 text-xs text-yue-code-inline-text" {...rest}>
      {children}
    </code>
  ),
  a: ({ href, children, ...rest }) => {
    const safeLink = href ? getSafeLink(href) : null
    if (!safeLink) return <span>{children}</span>
    return (
      <a
        href={safeLink.href}
        target={safeLink.external ? '_blank' : undefined}
        rel={safeLink.external ? 'noopener noreferrer' : undefined}
        className="text-yue-link underline decoration-yue-link/30 hover:text-yue-link-hover"
        {...rest}
      >
        {children}
      </a>
    )
  },
  img: ({ alt }) => alt ? (
    <span
      aria-label={`Imagem omitida: ${alt}`}
      className="text-xs text-muted-foreground"
    >
      [Imagem: {alt}]
    </span>
  ) : null,
  hr: () => <hr className="my-4 border-yue-border-subtle" />,
  table: ({ children, ...rest }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...rest}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...rest }) => (
    <th className="border border-yue-border-subtle bg-yue-surface-3 px-3 py-1.5 text-left font-semibold text-strong" {...rest}>
      {children}
    </th>
  ),
  td: ({ children, ...rest }) => (
    <td className="border border-yue-border-subtle px-3 py-1.5 text-foreground" {...rest}>
      {children}
    </td>
  ),
  // Task lists
  input: ({ ...rest }) => (
    <input type="checkbox" disabled {...rest} className="mr-1.5 h-3.5 w-3.5 accent-yue-accent" />
  ),
}

export function PanelAssistantMarkdown({ children }: PanelAssistantMarkdownProps) {
  return (
    <div className="prose-yue">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
