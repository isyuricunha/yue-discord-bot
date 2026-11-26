/**
 * Accessible form field wrapper
 *
 * Associates a visible <label> with a single form control (Input, Textarea or
 * Select). Generates a collision-free id with useId, renders the label via
 * htmlFor, and injects that id onto the child control through cloneElement so
 * screen readers announce the label and clicking the label focuses the control.
 *
 * Falls back to the child's existing id when one is provided.
 *
 * @param {React.ReactNode} props.label - Visible label text for the control
 * @param {React.ReactNode} [props.hint] - Optional secondary hint rendered under the label
 * @param {React.ReactNode} props.children - The form control to label
 * @param {string} [props.className] - Classes for the wrapper
 * @returns {JSX.Element} Labeled form field
 */
import * as React from 'react'

import { cn } from '../../lib/cn'

type form_field_props = {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  children: React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
  className?: string
}

export function FormField({ label, hint, error, children, className }: form_field_props) {
  const generated_id = React.useId()
  const hint_id = React.useId()
  const error_id = React.useId()

  const child_id = children.props.id ?? generated_id
  const has_error = Boolean(error)
  // The error message takes precedence over the hint in both the visible
  // sub-text and the aria-describedby association.
  const sub_text = error ?? hint
  const describedby = [
    children.props['aria-describedby'],
    has_error ? error_id : hint ? hint_id : undefined,
  ].filter(Boolean).join(' ')

  const control = React.cloneElement(children, {
    id: child_id,
    ...(describedby ? { 'aria-describedby': describedby } : {}),
    ...(has_error ? { 'aria-invalid': true } : {}),
  })

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <label htmlFor={child_id} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {control}
      {sub_text && (
        <span
          id={has_error ? error_id : hint_id}
          className={cn('text-xs', has_error ? 'text-danger' : 'text-muted-foreground/80')}
          role={has_error ? 'alert' : undefined}
        >
          {sub_text}
        </span>
      )}
    </div>
  )
}

FormField.displayName = 'FormField'
