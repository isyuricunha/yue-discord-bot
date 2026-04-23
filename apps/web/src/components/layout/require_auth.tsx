import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '../../store/auth'
import { Skeleton } from '../ui/skeleton'

type require_auth_props = {
  children: React.ReactNode
}

export function RequireAuth({ children }: require_auth_props) {
  const { user, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
