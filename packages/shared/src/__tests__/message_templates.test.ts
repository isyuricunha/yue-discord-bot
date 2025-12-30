import test from 'node:test'
import assert from 'node:assert/strict'

import { pick_discord_message_template_variant, render_discord_message_template, render_placeholders } from '../message_templates'
import {
  modlog_template_placeholders,
  welcome_template_placeholders,
  xp_template_placeholders,
  all_template_placeholders,
} from '../template_placeholders'

test('render_placeholders: replaces known placeholders and keeps unknown ones', () => {
  const rendered = render_placeholders('Oi {user}! {unknown}', {
    user: { id: '1', username: 'alice' },
  })

  assert.equal(rendered, 'Oi alice! {unknown}')
})

test('render_discord_message_template: plain text template', () => {
  const rendered = render_discord_message_template('Hello {@user}, level {level}', {
    user: { id: '123', username: 'bob' },
    level: 5,
  })

  assert.deepEqual(rendered, { content: 'Hello <@123>, level 5' })
})

test('render_discord_message_template: experience placeholders', () => {
  const rendered = render_discord_message_template(
    'rank #{experience.ranking} next={experience.next-level} need={experience.next-level.required-xp} total={experience.next-level.total-xp}',
    {
      experience: {
        ranking: 3,
        nextLevel: {
          level: 11,
          requiredXp: 250,
          totalXp: 11000,
        },
      },
    }
  )

  assert.deepEqual(rendered, {
    content: 'rank #3 next=11 need=250 total=11000',
  })
})

test('render_discord_message_template: extended JSON template (content + embed)', () => {
  const template = JSON.stringify({
    content: '{@user}',
    embed: {
      title: 'Level up!',
      description: '{user.tag} virou nível {level}',
      color: 16773632,
      footer: { text: 'guild: {guild}' },
    },
  })

  const rendered = render_discord_message_template(template, {
    user: { id: '7', username: 'carol', tag: 'carol#0001' },
    guild: { id: 'g1', name: 'my guild' },
    level: 10,
  })

  assert.deepEqual(rendered, {
    content: '<@7>',
    embeds: [
      {
        title: 'Level up!',
        description: 'carol#0001 virou nível 10',
        color: 16773632,
        footer: { text: 'guild: my guild' },
      },
    ],
  })
})

test('render_discord_message_template: invalid JSON should be treated as plain text', () => {
  const rendered = render_discord_message_template('{not json}', {
    user: { id: '1', username: 'alice' },
  })

  assert.deepEqual(rendered, { content: '{not json}' })
})

test('pick_discord_message_template_variant: keeps JSON template as-is', () => {
  const template = JSON.stringify({ content: 'hi' })
  assert.equal(pick_discord_message_template_variant(template, () => 0.9), template)
})

test('pick_discord_message_template_variant: picks a random item from JSON array (strings)', () => {
  const template = JSON.stringify(['Oi {@user}!', 'Parabéns {@user}, nível {level}!'])

  assert.equal(pick_discord_message_template_variant(template, () => 0), 'Oi {@user}!')
  assert.equal(pick_discord_message_template_variant(template, () => 0.99), 'Parabéns {@user}, nível {level}!')
})

test('pick_discord_message_template_variant: picks a random item from JSON array (extended message)', () => {
  const variants = [
    { content: 'A', embed: { title: 't1' } },
    { content: 'B', embed: { title: 't2' } },
  ]

  const template = JSON.stringify(variants)
  assert.equal(pick_discord_message_template_variant(template, () => 0), JSON.stringify(variants[0]))
  assert.equal(pick_discord_message_template_variant(template, () => 0.99), JSON.stringify(variants[1]))
})

test('pick_discord_message_template_variant: picks a random non-empty line', () => {
  const template = '\nOi {@user}!\n\nParabéns {@user}, nível {level}!\n'

  assert.equal(pick_discord_message_template_variant(template, () => 0), 'Oi {@user}!')
  assert.equal(pick_discord_message_template_variant(template, () => 0.99), 'Parabéns {@user}, nível {level}!')
})

test('template_placeholders: exported placeholders are renderable (no drift)', () => {
  const ctx = {
    user: {
      id: 'u1',
      username: 'alice',
      tag: 'alice#0001',
      discriminator: '0001',
      avatarUrl: 'https://example.com/user.png',
      nickname: 'ali',
    },
    staff: {
      id: 's1',
      username: 'mod',
      tag: 'mod#0002',
      discriminator: '0002',
      avatarUrl: 'https://example.com/staff.png',
    },
    guild: {
      id: 'g1',
      name: 'my guild',
      memberCount: 123,
      iconUrl: 'https://example.com/guild.png',
    },
    level: 10,
    xp: 900,
    experience: {
      ranking: 3,
      nextLevel: {
        level: 11,
        requiredXp: 250,
        totalXp: 11000,
      },
    },
    reason: 'because',
    duration: '5m',
    punishment: 'ban',
  }

  const groups = [
    all_template_placeholders,
    welcome_template_placeholders,
    xp_template_placeholders,
    modlog_template_placeholders,
  ]

  for (const group of groups) {
    for (const ph of group) {
      const rendered = render_placeholders(ph.token, ctx)
      assert.notEqual(rendered, ph.token, `expected placeholder ${ph.token} to be rendered`)
      assert.ok(!rendered.includes('{'), `expected placeholder ${ph.token} to not contain '{' after rendering`)
      assert.ok(!rendered.includes('}'), `expected placeholder ${ph.token} to not contain '}' after rendering`)
    }
  }
})
