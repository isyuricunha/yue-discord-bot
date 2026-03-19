import React from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import { cn } from '../../lib/cn'
import { COMPONENTS } from './tokens'

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const location = useLocation()

  return (
    <nav 
      aria-label="Navegação principal"
      className={cn('flex items-center space-x-1 text-sm', className)}
    >
      <NavLink
        to="/"
        className={cn(
          'flex items-center space-x-1 text-muted-foreground hover:text-foreground transition-colors',
          location.pathname === '/' && 'text-foreground font-medium'
        )}
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Início</span>
      </NavLink>

      {items.map((item, index) => {
        const isActive = location.pathname === item.href

        return (
          <React.Fragment key={index}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            
            {item.href ? (
              <NavLink
                to={item.href}
                className={cn(
                  'flex items-center space-x-1 px-2 py-1 rounded-md transition-colors',
                  COMPONENTS.breadcrumb.itemPadding,
                  'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  isActive && 'text-foreground font-medium bg-muted/50'
                )}
              >
                {item.icon && <span className="h-4 w-4">{item.icon}</span>}
                <span>{item.label}</span>
              </NavLink>
            ) : (
              <div 
                className={cn(
                  'flex items-center space-x-1 px-2 py-1 rounded-md',
                  COMPONENTS.breadcrumb.itemPadding,
                  'text-foreground font-medium'
                )}
                aria-current="page"
              >
                {item.icon && <span className="h-4 w-4">{item.icon}</span>}
                <span>{item.label}</span>
              </div>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// Helper function to generate breadcrumbs from pathname
export function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const parts = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  // Remove guild ID from display and create proper path
  const cleanParts = parts.map(part => {
    if (/^\d+$/.test(part)) {
      return '[server]'
    }
    return part
  })

  // Build breadcrumb items
  let currentPath = ''
  cleanParts.forEach((part, index) => {
    if (part === '[server]') return // Skip server ID in breadcrumbs
    
    currentPath += `/${part}`
    
    // Convert kebab-case to Title Case
    const label = part
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    breadcrumbs.push({
      label,
      href: index === cleanParts.length - 1 ? undefined : currentPath,
    })
  })

  return breadcrumbs
}
