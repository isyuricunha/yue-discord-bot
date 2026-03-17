import { useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '../../lib/cn'

export type faq_item_props = {
    question: string
    children: ReactNode
    className?: string
}

export function faq_item({ question, children, className }: faq_item_props) {
    const id = useId()

    return (
        <details
            className={cn('rounded-xl border border-border/70 bg-surface/40 px-4 py-3', className)}
            aria-labelledby={`faq-question-${id}`}
        >
            <summary
                id={`faq-question-${id}`}
                className="cursor-pointer select-none text-sm font-medium text-foreground"
                role="button"
                aria-expanded="false"
                tabIndex={0}
            >
                {question}
            </summary>
            <div className="mt-2 space-y-2 text-sm text-muted-foreground">{children}</div>
        </details>
    )
}

export type command_item_props = {
    name: string
    description: string
    children: ReactNode
    id?: string
    className?: string
}

export function command_item({ name, description, children, id, className }: command_item_props) {
    const generatedId = id || `cmd-${name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`

    return (
        <details
            className={cn('rounded-xl border border-border/70 bg-surface/40 px-4 py-3', className)}
            aria-labelledby={`command-item-${generatedId}`}
        >
            <summary
                id={`command-item-${generatedId}`}
                className="cursor-pointer select-none text-sm font-medium text-foreground"
                role="button"
                aria-expanded="false"
                tabIndex={0}
            >
                <span className="font-mono">{name}</span>
                <span className="ml-2 text-muted-foreground">— {description}</span>
            </summary>
            <div className="mt-2 space-y-2 text-sm text-muted-foreground overflow-x-auto">{children}</div>
        </details>
    )
}

export type section_title_props = {
    children: string
    className?: string
}

export function section_title({ children, className }: section_title_props) {
    return (
        <div className={cn('text-sm font-semibold text-foreground', className)}>
            {children}
        </div>
    )
}

export type help_box_props = {
    title: string
    children: ReactNode
    className?: string
}

export function help_box({ title, children, className }: help_box_props) {
    return (
        <div className={cn('rounded-xl border border-border/70 bg-surface/40 px-4 py-3', className)}>
            <div className="text-sm font-medium text-foreground">{title}</div>
            <div className="mt-1 space-y-1 text-sm text-muted-foreground">{children}</div>
        </div>
    )
}

export type InlineCodeProps = {
    children: string
    className?: string
}

export function InlineCode({ children, className }: InlineCodeProps) {
    return <span className={cn('font-mono text-foreground', className)}>{children}</span>
}

// Alias for backward compatibility
export const inline_code = InlineCode

export type code_block_props = {
    children: ReactNode
    className?: string
}

export function code_block({ children, className }: code_block_props) {
    return (
        <div className={cn('overflow-x-auto rounded-lg bg-surface/60 p-3 font-mono text-xs', className)}>
            {children}
        </div>
    )
}

export type back_link_props = {
    to?: string
    label?: string
    className?: string
}

export function BackLink({ to = '/extras', label = 'Voltar para Extras', className }: back_link_props) {
    return (
        <Link
            to={to}
            className={cn(
                'inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4',
                className
            )}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
            </svg>
            {label}
        </Link>
    )
}
