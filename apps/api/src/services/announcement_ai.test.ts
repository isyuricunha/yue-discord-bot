import assert from 'node:assert/strict'
import test from 'node:test'

import {
  draft_release_announcement,
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

test('draft_release_announcement enumerates visible changes instead of defaulting to maintenance', async () => {
  const { complete, calls } = capturing_complete('anúncio gerado')
  const notes = [
    '### feat',
    '* **web:** resolve user names across panel pages (#46)',
  ].join('\n')

  const result = await draft_release_announcement(
    { tag: 'v3.14.0', notes },
    runtime,
    complete,
  )

  assert.equal(result, 'anúncio gerado')
  assert.equal(calls.length, 1)
  const call = calls[0]

  assert.ok(call.context.includes('v3.14.0'), 'context must carry the release tag')
  assert.ok(call.context.includes('#46'), 'context must carry the release notes')

  assert.ok(
    call.prompt.includes('liste cada mudança perceptível'),
    'prompt must instruct the model to enumerate visible changes',
  )
  assert.ok(
    call.prompt.includes(
      'Só trate a versão como atualização de manutenção quando as notas não citarem nenhuma mudança perceptível',
    ),
    'maintenance framing must be reserved for notes without visible changes',
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

test('humanize_announcement keeps the original content and trims the response', async () => {
  const { complete, calls } = capturing_complete('anúncio humanizado')

  const result = await humanize_announcement('anúncio do owner', runtime, complete)

  assert.equal(result, 'anúncio humanizado')
  assert.equal(calls.length, 1)
  assert.ok(calls[0].prompt.includes('anúncio do owner'))
  assert.ok(
    calls[0].prompt.includes('mesmo idioma do original'),
    'humanize must preserve the original language',
  )
})
