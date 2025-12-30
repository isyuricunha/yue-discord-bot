export type template_placeholder = {
  key: string
  token: string
  description?: string
}

function p(key: string, description?: string): template_placeholder {
  return { key, token: `{${key}}`, description }
}

export const welcome_template_placeholders: template_placeholder[] = [
  p('@user'),
  p('user'),
  p('user.tag'),
  p('user.id'),
  p('user.nickname'),
  p('guild'),
  p('guild-size'),
]

export const xp_template_placeholders: template_placeholder[] = [
  p('@user', 'menciona'),
  p('user', 'nome'),
  p('user.tag'),
  p('level'),
  p('xp'),
  p('experience.ranking'),
  p('experience.next-level'),
  p('experience.next-level.required-xp'),
  p('experience.next-level.total-xp'),
]

export const modlog_template_placeholders: template_placeholder[] = [
  p('@user'),
  p('user.tag'),
  p('user.id'),
  p('@staff'),
  p('staff.tag'),
  p('staff.id'),
  p('punishment'),
  p('reason'),
  p('duration'),
  p('guild'),
]

const template_placeholders = {
  welcome_template_placeholders,
  xp_template_placeholders,
  modlog_template_placeholders,
} as const

export default template_placeholders
