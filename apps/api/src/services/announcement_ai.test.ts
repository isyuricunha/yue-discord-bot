import assert from 'node:assert/strict'
import test from 'node:test'

import {
  build_release_context,
  draft_release_announcement,
  extract_pr_numbers,
  fetch_release_pr_summaries,
  humanize_announcement,
  type announcement_complete_fn,
} from './announcement_ai'
import { normalize_panel_ai_runtime, type panel_ai_runtime } from './panel_ai'

const runtime: panel_ai_runtime = normalize_panel_ai_runtime({
  provider: 'mistral',
})

type captured_call = {
  persona: string
  context: string
  prompt: string
}

function capturing_complete(response: string): {
  complete: announcement_complete_fn
  calls: captured_call[]
} {
  const calls: captured_call[] = []
  const complete: announcement_complete_fn = async (input) => {
    calls.push({
      persona: input.persona,
      context: input.context,
      prompt: input.messages.map((message) => message.content).join('\n'),
    })
    return `  ${response}  `
  }
  return { complete, calls }
}

test('extract_pr_numbers deduplicates and caps the referenced PRs', () => {
  const notes = 'fix: stuff (#46), closes #46, see (#123) and (#7)'
  assert.deepEqual(extract_pr_numbers(notes), [46, 123, 7])
  assert.deepEqual(extract_pr_numbers('no references here'), [])
})

test('build_release_context carries notes and PR material, omitting the empty section', () => {
  const release = { tag: 'v3.14.1', notes: 'changelog line' }

  const with_prs = build_release_context(release, ['#46 Painel por gente\nCorpos descrevem a mudança'])
  assert.ok(with_prs.includes('v3.14.1'))
  assert.ok(with_prs.includes('changelog line'))
  assert.ok(with_prs.includes('fonte mais confiável'))
  assert.ok(with_prs.includes('#46 Painel por gente'))

  const without_prs = build_release_context(release, [])
  assert.ok(!without_prs.includes('fonte mais confiável'))
})

test('draft_release_announcement enumerates visible changes and speaks in first person', async () => {
  const { complete, calls } = capturing_complete('anúncio gerado')
  const notes = [
    '### feat',
    '* **web:** resolve user names across panel pages (#46)',
  ].join('\n')

  const result = await draft_release_announcement(
    { tag: 'v3.14.0', notes },
    ['#46 resolve user names across panel pages\nThe panel now shows names instead of raw IDs.'],
    runtime,
    complete,
  )

  assert.equal(result, 'anúncio gerado')
  assert.equal(calls.length, 1)
  const call = calls[0]

  assert.ok(call.context.includes('v3.14.0'), 'context must carry the release tag')
  assert.ok(call.context.includes('#46'), 'context must carry the release notes')
  assert.ok(
    call.context.includes('The panel now shows names instead of raw IDs.'),
    'context must carry the PR body material',
  )

  assert.ok(
    call.prompt.includes('Fale em primeira pessoa ("eu")'),
    'prompt must require first person',
  )
  assert.ok(
    call.prompt.includes('A Yue nunca se refere a si mesma pelo nome'),
    'prompt must forbid third-person self references',
  )
  assert.ok(
    call.prompt.includes('liste cada mudança perceptível'),
    'prompt must instruct the model to enumerate visible changes',
  )
  assert.ok(
    call.prompt.includes('Só trate a versão como atualização de manutenção quando o material não citar nenhuma mudança perceptível'),
    'maintenance framing must be reserved for material without visible changes',
  )
  assert.ok(
    call.prompt.includes('nunca diga que não há mudanças'),
    'prompt must forbid claiming there are no changes when there are',
  )
})

test('announcement prompts replace dashes with named substitutes instead of a bare ban', async () => {
  const draft = capturing_complete('rascunho')
  const humanize = capturing_complete('humanizado')

  await draft_release_announcement(
    { tag: 'v3.15.0', notes: 'fix: something' },
    [],
    runtime,
    draft.complete,
  )
  await humanize_announcement('texto original', runtime, humanize.complete)

  for (const call of [...draft.calls, ...humanize.calls]) {
    assert.ok(
      call.prompt.includes('Nunca use travessão (—, – ou --)'),
      'prompt must name every dash character',
    )
    assert.ok(
      call.prompt.includes('vírgula, ponto, parênteses ou "e"'),
      'prompt must name the replacement punctuation instead of only banning the dash',
    )
  }
})

test('humanize_announcement keeps the original content, first person, and trims the response', async () => {
  const { complete, calls } = capturing_complete('anúncio humanizado')

  const result = await humanize_announcement('anúncio do owner', runtime, complete)

  assert.equal(result, 'anúncio humanizado')
  assert.equal(calls.length, 1)
  assert.ok(calls[0].prompt.includes('anúncio do owner'))
  assert.ok(
    calls[0].prompt.includes('Fale em primeira pessoa ("eu")'),
    'humanize must require first person too',
  )
  assert.ok(
    calls[0].prompt.includes('mesmo idioma do original'),
    'humanize must preserve the original language',
  )
})

test('fetch_release_pr_summaries keeps good PRs and skips unreachable ones', async () => {
  const original_fetch = globalThis.fetch
  const requested: string[] = []
  globalThis.fetch = (async (url: any) => {
    const target = String(url)
    requested.push(target)
    if (target.endsWith('/46')) {
      return {
        ok: true,
        json: async () => ({
          title: 'resolve user names across panel pages',
          body: 'Replaces raw IDs with cached usernames.',
        }),
      } as any
    }
    return { ok: false, json: async () => ({}) } as any
  }) as any

  try {
    const summaries = await fetch_release_pr_summaries('stuff (#46) and lost (#999)')
    assert.equal(requested.length, 2)
    assert.deepEqual(summaries, [
      '#46 resolve user names across panel pages\nReplaces raw IDs with cached usernames.',
    ])
  } finally {
    globalThis.fetch = original_fetch
  }
})
