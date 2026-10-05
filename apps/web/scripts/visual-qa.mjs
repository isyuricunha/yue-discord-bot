/**
 * YuTheme v2 visual QA for the yue web panel (test:visual).
 *
 * Boots `vite preview` on the built dist (or reuses a running preview when
 * PORT is set), then asserts computed YuTheme tokens, AMOLED surfaces, no
 * horizontal overflow at 1440/768/375, reduced-motion behavior, and captures
 * screenshots of the public shell + login as artifacts.
 *
 * Run: pnpm test:visual   (from apps/web; builds first, then boots preview)
 * Needs: a local Chromium for playwright-core (this machine has one).
 */
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = Number(process.env.PORT || 5199)
const BASE = `http://127.0.0.1:${PORT}`
const OUT = new URL('../e2e-output/visual-qa/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const TOKENS = {
  '--yu-bg-canvas': '#000000',
  '--yu-bg-window': '#0b0b0a',
  '--yu-bg-titlebar': '#121211',
  '--yu-bg-input': '#121211',
  '--yu-bg-popover': '#151514',
  '--yu-bg-chip': '#1a1a18',
  '--yu-text-primary': '#f4f1e8',
  '--yu-text-secondary': '#b3ad9f',
  '--yu-accent': '#d6a84f',
  '--yu-accent-glow': 'rgba(214, 168, 79, 0.08)',
  '--yu-border-default': 'rgba(232, 228, 216, 0.20)',
  '--yu-radius-window': '14px',
  '--yu-radius-lg': '12px',
}

const norm = (v) => {
  const s = String(v ?? '').toLowerCase().replace(/\s+/g, '')
  const short = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  const rgba = s.match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/)
  if (rgba) {
    const a = rgba[4] === undefined ? 255 : Math.round(parseFloat(rgba[4]) * 255)
    const h = (n) => Number(n).toString(16).padStart(2, '0')
    return `#${h(rgba[1])}${h(rgba[2])}${h(rgba[3])}${h(a)}`
  }
  return s
}

const results = []
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`)

let preview = null
async function bootPreview() {
  if (process.env.PORT) return // reuse an externally hosted preview
  preview = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: 'ignore',
  })
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return
    } catch { /* preview not ready yet; retry */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview did not become ready')
}

try {
  await bootPreview()
  const browser = await chromium.launch({ headless: true })
  for (const [w, h, label] of [
    [1440, 900, 'desktop'],
    [768, 900, 'tablet'],
    [375, 812, 'mobile'],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/login-${label}.png` })

    await page.goto(`${BASE}/privacidade`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/shell-${label}.png` })
    const shellBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    check(`shell body bg AMOLED @${label}`, shellBg === 'rgb(0, 0, 0)', `got ${shellBg}`)

    const got = await page.evaluate((names) => {
      const s = getComputedStyle(document.documentElement)
      return Object.fromEntries(names.map((n) => [n, s.getPropertyValue(n).trim()]))
    }, Object.keys(TOKENS))
    for (const [k, want] of Object.entries(TOKENS)) {
      const g = got[k] ?? ''
      check(`token ${k} @${label}`, norm(g) === norm(want), `got ${g || '(empty)'}`)
    }

    const ovf = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    check(`no horizontal overflow @${label}`, ovf <= 0, `delta ${ovf}px`)

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    check(`body bg AMOLED @${label}`, bg === 'rgb(0, 0, 0)', `got ${bg}`)

    check(`no page errors @${label}`, errors.length === 0, errors.join(' | ').slice(0, 160))
    await ctx.close()
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/login-reduced-motion.png` })
    const anim = await page.evaluate(() => {
      const a = getComputedStyle(document.body).animationName
      return a && a !== 'none' ? a : ''
    })
    check('reduced motion: no body animation', anim === '', anim)
    await ctx.close()
  }
  await browser.close()
} finally {
  preview?.kill()
}

console.log(results.join('\n'))
const fails = results.filter((r) => r.startsWith('FAIL')).length
console.log(`\n${results.length - fails}/${results.length} checks passed`)
process.exit(fails ? 1 : 0)