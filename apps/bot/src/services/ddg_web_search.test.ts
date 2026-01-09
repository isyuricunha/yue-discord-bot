import test from 'node:test'
import assert from 'node:assert/strict'

import { ddg_web_search, format_web_search_context, parse_web_search_query } from './ddg_web_search'

test('ddg_web_search: parse_web_search_query parses pesquisa/web/search prefixes', () => {
  assert.equal(parse_web_search_query('pesquisa: one piece'), 'one piece')
  assert.equal(parse_web_search_query('Pesquisar: one piece'), 'one piece')
  assert.equal(parse_web_search_query('web: node 24'), 'node 24')
  assert.equal(parse_web_search_query('search: redis ttl'), 'redis ttl')
  assert.equal(parse_web_search_query('pesquisa one piece'), 'one piece')
  assert.equal(parse_web_search_query('web node 24'), 'node 24')

  assert.equal(parse_web_search_query('hello'), null)
  assert.equal(parse_web_search_query('pesquisa:'), null)
})

test('ddg_web_search: returns abstract and topics hits from duckduckgo json', async () => {
  const fetch_fn: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        AbstractText: 'Example abstract',
        AbstractURL: 'https://example.com/abstract',
        RelatedTopics: [
          { Text: 'Hit 1', FirstURL: 'https://example.com/1' },
          {
            Topics: [{ Text: 'Hit 2', FirstURL: 'https://example.com/2' }],
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }

  const result = await ddg_web_search('hello', { fetch_fn, timeout_ms: 5_000 })
  assert.equal(result.query, 'hello')
  assert.equal(result.abstract_text, 'Example abstract')
  assert.equal(result.abstract_url, 'https://example.com/abstract')
  assert.equal(result.hits.length, 2)
  assert.equal(result.hits[0]?.url, 'https://example.com/1')
  assert.equal(result.hits[1]?.url, 'https://example.com/2')

  const context = format_web_search_context(result)
  assert.ok(context.includes('Web search query: hello'))
  assert.ok(context.includes('Example abstract'))
  assert.ok(context.includes('https://example.com/1'))
  assert.ok(context.includes('https://example.com/2'))
})

test('ddg_web_search: handles non-ok response', async () => {
  const fetch_fn: typeof fetch = async () => {
    return new Response('nope', { status: 500 })
  }

  const result = await ddg_web_search('hello', { fetch_fn })
  assert.equal(result.hits.length, 0)
  assert.equal(result.abstract_text, null)
  assert.equal(result.abstract_url, null)
})
