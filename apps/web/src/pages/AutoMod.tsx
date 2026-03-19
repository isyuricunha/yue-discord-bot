import { Navigate } from 'react-router-dom'

export { AutoModSections, type GuildConfig } from '../components/moderation/automod_sections'

export default function AutoModPage() {
  return <Navigate to="../moderation" replace />
}
