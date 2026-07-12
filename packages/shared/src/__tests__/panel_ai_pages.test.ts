import test from 'node:test'
import assert from 'node:assert/strict'
import { PANEL_AI_PAGES } from '../panel_ai_pages'

const EXPECTED_ROUTES = [
  '/guild/:guildId',
  '/guild/:guildId/overview',
  '/guild/:guildId/automod',
  '/guild/:guildId/antiraid',
  '/guild/:guildId/modlogs',
  '/guild/:guildId/music',
  '/guild/:guildId/custom-commands',
  '/guild/:guildId/keyword-triggers',
  '/guild/:guildId/audit',
  '/guild/:guildId/commands',
  '/guild/:guildId/members',
  '/guild/:guildId/members/:userId',
  '/guild/:guildId/giveaways',
  '/guild/:guildId/giveaways/create',
  '/guild/:guildId/giveaways/:giveawayId',
  '/guild/:guildId/xp',
  '/guild/:guildId/autorole',
  '/guild/:guildId/tickets',
  '/guild/:guildId/support',
  '/guild/:guildId/suggestions',
  '/guild/:guildId/reaction-roles',
  '/guild/:guildId/starboard',
  '/guild/:guildId/free-games',
  '/guild/:guildId/setup',
  '/guild/:guildId/moderation',
  '/guild/:guildId/welcome',
  '/guild/:guildId/settings',
  '/guild/:guildId/assistant',
]

test('shared registry: exactly 28 authenticated guild page definitions exist', () => {
  assert.equal(PANEL_AI_PAGES.length, 28)
})

test('shared registry: every key and route pattern is unique', () => {
  const keys = new Set<string>()
  const patterns = new Set<string>()

  for (const page of PANEL_AI_PAGES) {
    assert.ok(!keys.has(page.key), `Duplicate key: ${page.key}`)
    assert.ok(!patterns.has(page.routePattern), `Duplicate route pattern: ${page.routePattern}`)
    keys.add(page.key)
    patterns.add(page.routePattern)
  }
})

test('shared registry: matches App.tsx routes under /guild/:guildId exactly', () => {
  const registryPatterns: readonly string[] = PANEL_AI_PAGES.map((p) => p.routePattern)

  for (const route of EXPECTED_ROUTES) {
    assert.ok(
      registryPatterns.includes(route),
      `Route ${route} declared in App.tsx is missing from the registry`
    )
  }

  for (const page of PANEL_AI_PAGES) {
    assert.ok(
      EXPECTED_ROUTES.includes(page.routePattern),
      `Registry contains stale definition for nonexistent route: ${page.routePattern}`
    )
  }
})

test('shared registry: specific routes precede parent routes in matching order', () => {
  const memberDetailsIndex = PANEL_AI_PAGES.findIndex((p) => p.key === 'member-details')
  const membersIndex = PANEL_AI_PAGES.findIndex((p) => p.key === 'members')
  assert.ok(memberDetailsIndex < membersIndex, 'member-details must precede members')

  const giveawayCreateIndex = PANEL_AI_PAGES.findIndex((p) => p.key === 'giveaway-create')
  const giveawayDetailsIndex = PANEL_AI_PAGES.findIndex((p) => p.key === 'giveaway-details')
  const giveawaysIndex = PANEL_AI_PAGES.findIndex((p) => p.key === 'giveaways')
  assert.ok(giveawayCreateIndex < giveawaysIndex, 'giveaway-create must precede giveaways')
  assert.ok(giveawayDetailsIndex < giveawaysIndex, 'giveaway-details must precede giveaways')
})

test('shared registry: every field is non-empty', () => {
  for (const page of PANEL_AI_PAGES) {
    assert.ok(page.key.trim().length > 0, `Empty key for ${page.key}`)
    assert.ok(page.routePattern.trim().length > 0, `Empty routePattern for ${page.key}`)
    assert.ok(page.title.trim().length > 0, `Empty title for ${page.key}`)
    assert.ok(page.section.trim().length > 0, `Empty section for ${page.key}`)
    assert.ok(page.purpose.trim().length > 0, `Empty purpose for ${page.key}`)
  }
})

test('shared registry: route patterns contain placeholders, not concrete IDs', () => {
  for (const page of PANEL_AI_PAGES) {
    assert.ok(page.routePattern.includes(':guildId'), `Pattern ${page.routePattern} lacks :guildId`)
    assert.ok(!page.routePattern.includes('guild-1'), `Pattern ${page.routePattern} contains concrete ID guild-1`)
    assert.ok(!page.routePattern.includes('user-1'), `Pattern ${page.routePattern} contains concrete ID user-1`)
  }
})

test('shared registry: definitions contain no system/provider terminology or invented capabilities', () => {
  const forbiddenWords = [
    'mistral', 'openai', 'llm', 'model', 'prompt', 'secret',
    'credential', 'infrastructure', 'runtime', 'api', 'token',
    'mass-mention', 'bot-attack', 'prefix',
  ]

  for (const page of PANEL_AI_PAGES) {
    const text = `${page.title} ${page.section} ${page.purpose}`.toLowerCase()
    for (const word of forbiddenWords) {
      assert.ok(
        !text.includes(word),
        `Registry entry for ${page.key} contains forbidden word: "${word}"`
      )
    }
  }
})

test('shared registry: registry is readonly by type/design', () => {
  // @ts-expect-error - testing readonly behavior
  assert.throws(() => { PANEL_AI_PAGES[0] = { key: 'foo' } })
  // @ts-expect-error - testing readonly behavior
  assert.throws(() => { PANEL_AI_PAGES[0].title = 'changed' })

  assert.ok(Object.isFrozen(PANEL_AI_PAGES), 'Registry should be frozen')
  assert.ok(Object.isFrozen(PANEL_AI_PAGES[0]), 'Registry entries should be frozen')
})
