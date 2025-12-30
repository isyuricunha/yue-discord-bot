export type template_placeholder = {
  key: string
  token: string
  description?: string
}

function p(key: string, description?: string): template_placeholder {
  return { key, token: `{${key}}`, description }
}

type template_placeholder_key = template_placeholder['key']

export const all_template_placeholders: template_placeholder[] = [
  p('user', 'Nome do usuário'),
  p('@user', 'Menciona o usuário'),
  p('user.id', 'ID do usuário'),
  p('user.tag', 'Tag do usuário (ex: name#0001)'),
  p('user.discriminator', 'Discriminator do usuário'),
  p('user.avatar', 'URL do avatar do usuário'),
  p('user.nickname', 'Apelido do usuário no servidor'),

  p('staff', 'Nome do moderador/equipe'),
  p('@staff', 'Menciona o moderador/equipe'),
  p('staff.id', 'ID do moderador/equipe'),
  p('staff.tag', 'Tag do moderador/equipe'),
  p('staff.discriminator', 'Discriminator do moderador/equipe'),
  p('staff.avatar', 'URL do avatar do moderador/equipe'),

  p('guild', 'Nome do servidor'),
  p('guild-size', 'Quantidade de membros do servidor'),
  p('guild-icon-url', 'URL do ícone do servidor'),

  p('level', 'Nível atual do usuário'),
  p('xp', 'XP atual do usuário'),
  p('experience.ranking', 'Posição no ranking de XP'),
  p('experience.next-level', 'Próximo nível'),
  p('experience.next-level.required-xp', 'XP necessário para o próximo nível'),
  p('experience.next-level.total-xp', 'XP total necessário até o próximo nível'),

  p('reason', 'Motivo da punição/ação'),
  p('duration', 'Duração da punição/ação'),
  p('punishment', 'Tipo de punição aplicada'),
]

const placeholder_by_key = all_template_placeholders.reduce<Record<template_placeholder_key, template_placeholder>>((acc, ph) => {
  acc[ph.key] = ph
  return acc
}, {} as Record<template_placeholder_key, template_placeholder>)

function pick(keys: readonly template_placeholder_key[]): template_placeholder[] {
  return keys.map((key) => {
    const found = placeholder_by_key[key]
    if (!found) {
      throw new Error(`Unknown template placeholder key: ${key}`)
    }
    return found
  })
}

export const welcome_template_placeholders: template_placeholder[] = pick([
  '@user',
  'user',
  'user.tag',
  'user.id',
  'user.nickname',
  'guild',
  'guild-size',
  'guild-icon-url',
])

export const xp_template_placeholders: template_placeholder[] = pick([
  '@user',
  'user',
  'user.tag',
  'level',
  'xp',
  'experience.ranking',
  'experience.next-level',
  'experience.next-level.required-xp',
  'experience.next-level.total-xp',
])

export const modlog_template_placeholders: template_placeholder[] = pick([
  '@user',
  'user.tag',
  'user.id',
  '@staff',
  'staff.tag',
  'staff.id',
  'punishment',
  'reason',
  'duration',
  'guild',
  'guild-icon-url',
])

const template_placeholders = {
  all_template_placeholders,
  welcome_template_placeholders,
  xp_template_placeholders,
  modlog_template_placeholders,
} as const

export default template_placeholders
