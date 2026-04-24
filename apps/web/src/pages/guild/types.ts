/**
 * Types para a página /guild/{guildId}
 */

export interface Guild {
  id: string
  name: string
  icon: string | null
}

export type ModuleCategory = 'essentials' | 'automation' | 'engagement' | 'support' | 'admin'

export interface ModuleCard {
  to: string
  label: string
  description: string
  icon: React.ReactNode
  category: ModuleCategory
}

export interface GuildModulesResponse {
  guild: Guild
  modules: ModuleCard[]
}