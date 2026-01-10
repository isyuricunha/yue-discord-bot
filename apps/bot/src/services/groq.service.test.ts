import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { create_groq_client_for_tests, GroqApiError, load_groq_system_prompt } from './groq.service'

test('groq: falls back to next key on 429', async () => {
  const calls: string[] = []

  const fetch_fn: typeof fetch = async (_url, init) => {
    const auth = String((init?.headers as any)?.authorization ?? '')
    calls.push(auth)

    if (auth.includes('key-1')) {
      return new Response(JSON.stringify({ error: { message: 'rate limit' } }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '5' },
      })
    }

    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'hello from key-2' } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }

  const client = create_groq_client_for_tests({
    keys: ['key-1', 'key-2'],
    fetch_fn,
    now_ms: () => 0,
    system_prompt: async () => 'system',
  })

  const result = await client.create_completion({ user_prompt: 'hi' })
  assert.equal(result.content, 'hello from key-2')
  assert.equal(result.used_key_index, 1)

  assert.equal(calls.length, 2)
  assert.equal(calls[0], 'Bearer key-1')
  assert.equal(calls[1], 'Bearer key-2')
})

test('groq: throws when all keys are cooling down', async () => {
  let call_count = 0

  const fetch_fn: typeof fetch = async () => {
    call_count += 1
    return new Response(JSON.stringify({ error: { message: 'rate limit' } }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '10' },
    })
  }

  const now = { value: 0 }

  const client = create_groq_client_for_tests({
    keys: ['key-1', 'key-2'],
    fetch_fn,
    now_ms: () => now.value,
    system_prompt: async () => 'system',
  })

  await assert.rejects(
    async () => {
      await client.create_completion({ user_prompt: 'hi' })
    },
    (err: unknown) => {
      assert.ok(err instanceof GroqApiError)
      assert.equal(err.status, 429)
      assert.ok(typeof err.retry_after_seconds === 'number')
      return true
    }
  )

  assert.equal(call_count, 2)
})

test('groq: loads system prompt from file', async () => {
  const base_tmp = join(process.cwd(), '.tmp')
  await mkdir(base_tmp, { recursive: true })
  const dir = await mkdtemp(join(base_tmp, 'yue-groq-'))
  const prompt_path = join(dir, 'prompt.txt')
  await writeFile(prompt_path, '  hello prompt  ', 'utf8')

  const prev = process.env.GROQ_PROMPT_PATH
  process.env.GROQ_PROMPT_PATH = prompt_path

  try {
    const prompt = await load_groq_system_prompt()
    assert.equal(prompt, 'hello prompt')
  } finally {
    if (prev === undefined) delete process.env.GROQ_PROMPT_PATH
    else process.env.GROQ_PROMPT_PATH = prev

    await rm(dir, { recursive: true, force: true })
  }
})
