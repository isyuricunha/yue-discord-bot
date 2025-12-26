import { CONFIG } from '../config'

export function is_owner(user_id: string): boolean {
  const owners = CONFIG.admin.ownerUserIds
  return Array.isArray(owners) && owners.includes(user_id)
}
