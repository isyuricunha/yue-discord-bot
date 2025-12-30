import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '../../store/auth'

type require_owner_props = {
  children: React.ReactNode
}

export function RequireOwner({ children }: require_owner_props) {
  const { user, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!user.isOwner) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
