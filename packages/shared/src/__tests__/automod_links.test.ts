import test from 'node:test'
import assert from 'node:assert/strict'

import {
  evaluate_automod_link_policy,
  extract_link_hostnames,
  link_hostname_matches_domain,
  normalize_link_domain,
} from '../automod_links'
import { guildAutomodConfigSchema } from '../validators'

test('automod links: normalizes domains and URLs', () => {
  assert.equal(normalize_link_domain(' https://WWW.Example.com/path '), 'example.com')
  assert.equal(normalize_link_domain('*.sub.example.com'), 'sub.example.com')
  assert.equal(normalize_link_domain('ftp://example.com'), null)
})

test('automod links: extracts protocol, www, and bare domain links without emails', () => {
  assert.deepEqual(
    extract_link_hostnames(
      'See https://store.example.com/a, www.discord.com/test and steamgifts.com/giveaway. Mail test@example.com.',
    ),
    ['store.example.com', 'discord.com', 'steamgifts.com'],
  )
})

test('automod links: domain matching includes subdomains but not suffix lookalikes', () => {
  assert.equal(link_hostname_matches_domain('store.example.com', 'example.com'), true)
  assert.equal(link_hostname_matches_domain('example.com.attacker.test', 'example.com'), false)
  assert.equal(link_hostname_matches_domain('fakeexample.com', 'example.com'), false)
})

test('automod links: trusted domains bypass matching rules', () => {
  const result = evaluate_automod_link_policy({
    content: 'https://help.example.com/article',
    linkFilterEnabled: true,
    linkBlockAll: true,
    blockedDomains: [],
    trustedDomains: ['example.com'],
    noRoleEnabled: true,
    memberHasRoles: false,
  })

  assert.equal(result, null)
})

test('automod links: blocked domains take precedence over the no-role rule', () => {
  const result = evaluate_automod_link_policy({
    content: 'steamgifts.com/giveaway',
    linkFilterEnabled: true,
    linkBlockAll: false,
    blockedDomains: ['steamgifts.com'],
    trustedDomains: [],
    noRoleEnabled: true,
    memberHasRoles: false,
  })

  assert.deepEqual(result, {
    rule: 'blocked_domain',
    hostname: 'steamgifts.com',
    configuredDomain: 'steamgifts.com',
  })
})

test('automod links: no-role rule blocks otherwise unknown domains', () => {
  const result = evaluate_automod_link_policy({
    content: 'Try unknown.example/path',
    linkFilterEnabled: false,
    linkBlockAll: false,
    blockedDomains: [],
    trustedDomains: [],
    noRoleEnabled: true,
    memberHasRoles: false,
  })

  assert.deepEqual(result, {
    rule: 'member_without_roles',
    hostname: 'unknown.example',
  })
})

test('automod links: config schema normalizes domains and timeout durations', () => {
  const result = guildAutomodConfigSchema.safeParse({
    bannedDomains: ['HTTPS://WWW.Example.com/path', '*.example.com'],
    allowedDomains: ['help.example.org'],
    linkTimeoutDuration: ' 5M ',
    linkNoRoleTimeoutDuration: '28d',
  })

  assert.equal(result.success, true)
  if (!result.success) return

  assert.deepEqual(result.data.bannedDomains, ['example.com'])
  assert.deepEqual(result.data.allowedDomains, ['help.example.org'])
  assert.equal(result.data.linkTimeoutDuration, '5m')
  assert.equal(result.data.linkNoRoleTimeoutDuration, '28d')
})

test('automod links: config schema rejects invalid domains and timeouts beyond Discord limits', () => {
  assert.equal(guildAutomodConfigSchema.safeParse({ bannedDomains: ['not a domain'] }).success, false)
  assert.equal(guildAutomodConfigSchema.safeParse({ linkNoRoleTimeoutDuration: '29d' }).success, false)
})
