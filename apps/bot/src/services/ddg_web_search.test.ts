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

test('ddg_web_search: falls back to html results when json has no sources', async () => {
  const calls: string[] = []

  const fetch_fn: typeof fetch = async (url) => {
    calls.push(String(url))

    if (String(url).startsWith('https://api.duckduckgo.com/')) {
      return new Response(
        JSON.stringify({
          AbstractText: '',
          AbstractURL: '',
          RelatedTopics: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    if (String(url).startsWith('https://duckduckgo.com/html/')) {
      return new Response(
        [
          '<html><body>',
          '<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F1">Result One</a>',
          '<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F2">Result Two</a>',
          '</body></html>',
        ].join(''),
        { status: 200, headers: { 'content-type': 'text/html' } }
      )
    }

    return new Response('unexpected', { status: 500 })
  }

  const result = await ddg_web_search('cotacao do dolar', { fetch_fn, timeout_ms: 5_000 })
  assert.ok(calls.some((c) => c.startsWith('https://api.duckduckgo.com/')))
  assert.ok(calls.some((c) => c.startsWith('https://duckduckgo.com/html/')))
  assert.equal(result.hits.length, 2)
  assert.equal(result.hits[0]?.url, 'https://example.com/1')
  assert.equal(result.hits[1]?.url, 'https://example.com/2')
})

test('ddg_web_search: format_web_search_context reports no sources when empty', () => {
  const context = format_web_search_context({ query: 'q', abstract_text: null, abstract_url: null, hits: [] })
  assert.ok(context.includes('No sources were found for this query.'))
})
