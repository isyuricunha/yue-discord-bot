/**
 * YuTheme v2 theme guard for the web panel.
 *
 * Validates that apps/web/src/index.css keeps every base --yu-* token on the
 * canonical YuTheme v2 (AMOLED) values, that no v1-era colors or yudark-*
 * selectors/classes remain anywhere in the frontend, and that the last legacy
 * hardcoded color (FreeGames role dot gray) stays on the theme token.
 *
 * Run: pnpm test:theme  (wired as `test:theme` in package.json)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = join(here, '..')
const cssPath = join(webRoot, 'src', 'index.css')

const failures = []
function check(name, ok, details = '') {
  if (!ok) failures.push(`${name}${details ? `: ${details}` : ''}`)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${details ? ` (${details})` : ''}`)
}

const css = readFileSync(cssPath, 'utf8')
const start = css.indexOf(':root,')
const end = css.indexOf('\n}', start)
check('index.css has the :root token block', start !== -1 && end !== -1)

const tokens = {}
const block = css.slice(start, end)
for (const m of block.matchAll(/--(yu-[a-z0-9-]+):\s*([^;]+);/g)) {
  tokens[m[1]] = m[2].trim()
}

// Canonical YuTheme v2 (AMOLED) base tokens. Source: yutheme-design-system
// skill, references/tokens.md. Names are the panel's own --yu-* surface.
const canonical = {
  'yu-bg-base': '#000000',
  'yu-bg-canvas': '#000000',
  'yu-bg-page': '#000000',
  'yu-bg-window': '#0b0b0a',
  'yu-bg-panel': '#0b0b0a',
  'yu-bg-sidebar': '#000000',
  'yu-bg-titlebar': '#121211',
  'yu-bg-editor': '#10100f',
  'yu-bg-terminal': '#10100f',
  'yu-bg-composer': '#121211',
  'yu-bg-modal': '#0f0f0e',
  'yu-bg-hover': '#141413',
  'yu-bg-active': '#1f1f1d',
  'yu-bg-input': '#121211',
  'yu-bg-input-hover': '#1a1a18',
  'yu-bg-popover': '#151514',
  'yu-bg-tooltip': '#151514',
  'yu-bg-chip': '#1a1a18',
  'yu-text-primary': '#f4f1e8',
  'yu-text-strong': '#fffdf7',
  'yu-text-secondary': '#b3ad9f',
  'yu-text-muted': '#8e887c',
  'yu-text-dim': '#666157',
  'yu-text-disabled': '#54504a',
  'yu-text-on-accent': '#15130f',
  'yu-accent': '#d6a84f',
  'yu-accent-hover': '#e0b760',
  'yu-accent-glow': 'rgba(214, 168, 79, 0.08)',
  'yu-link': '#64d2ff',
  'yu-link-hover': '#7cd9ff',
  'yu-success': '#31d158',
  'yu-agent': '#bf5af2',
  'yu-danger': '#ff6961',
  'yu-info': '#64d2ff',
  'yu-info-hover': '#7cd9ff',
  'yu-border-default': 'rgba(232, 228, 216, 0.20)',
  'yu-radius-window': '14px',
  'yu-radius-lg': '12px',
  'yu-radius-md': '8px',
  'yu-duration-base': '160ms',
}
const norm = (value) => value.toLowerCase().replace(/\s+/g, '')

for (const [name, want] of Object.entries(canonical)) {
  const got = tokens[name]
  check(`token --${name} matches YuTheme v2`, got !== undefined && norm(got) === norm(want), got ? `got ${got}, want ${want}` : 'missing')
}

// v1 legacy palette must not come back anywhere in the frontend source.
const legacyHexes = [
  '#1a1813', '#191811', '#1b1913', '#201e17', '#24211b', '#17160f', '#18170f',
  '#2a271f', '#332f25', '#1e1c16', '#26231c', '#1f1d17', '#b8b2a4', '#827c70',
  '#5f5a50', '#4f4a42',
]
const legacyRgb = /rgba\(\s*214,\s*204,\s*176/

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full, files))
    else files.push(full)
  }
  return files
}

const sourceRoots = [
  join(webRoot, 'src'),
  join(webRoot, 'scripts'),
  join(webRoot, '..', 'tailwind.config.js'),
]
const sourceFiles = sourceRoots.flatMap((root) => {
  try {
    if (statSync(root).isFile()) return [root]
    return walk(root).filter((f) => /\.(ts|tsx|css|js|mjs|html)$/.test(f))
  } catch {
    return []
  }
})

let legacyHits = 0
for (const file of sourceFiles) {
  // Skip the guard itself: it contains the legacy palette by definition.
  if (file.endsWith('verify-theme.mjs')) continue
  const content = readFileSync(file, 'utf8')
  for (const hex of legacyHexes) {
    if (content.toLowerCase().includes(hex)) {
      failures.push(`legacy v1 color ${hex} in ${file.replace(webRoot, 'apps/web')}`)
      legacyHits += 1
    }
  }
  if (legacyRgb.test(content)) {
    failures.push(`legacy v1 border base rgba(214, 204, 176, ...) in ${file.replace(webRoot, 'apps/web')}`)
    legacyHits += 1
  }
}
check('no legacy v1 colors in frontend source', legacyHits === 0, `${legacyHits} hit(s)`)

// Tailwind color-alias classes from the v1 era are gone: the panel must use
// the semantic token names (success/agent/info/danger/accent*) directly.
const aliasRe = /\b(?:text|bg|border|ring|fill|stroke|from|to|via|shadow|divide|outline)-(?:green|emerald|purple|blue|cyan|red|yellow|amber|orange)-\d+\b|\bshadow-(?:cursor|yudark)(?:Sm|Md|Lg)\b|\banimate-(?:shimmer|textShimmer)\b/
let aliasHits = 0
for (const file of sourceFiles) {
  if (file.endsWith('verify-theme.mjs')) continue
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (aliasRe.test(line)) {
      failures.push(`tailwind v1 alias class in ${file.replace(webRoot, 'apps/web')}: ${line.trim().slice(0, 100)}`)
      aliasHits += 1
    }
  }
}
check('no v1-era tailwind alias classes in frontend source', aliasHits === 0, `${aliasHits} hit(s)`)

// yudark-* survives only as the data-theme hook (data-theme="yudark") and its
// selector in index.css; the selector CLASSES (.yudark-window, ...) are dead.
const yudarkClassUsages = [...css.matchAll(/\.yudark-[a-z-]+/g)].length
check('no .yudark-* selector classes in index.css', yudarkClassUsages === 0, `${yudarkClassUsages} selector(s)`)
check('data-theme="yudark" hook kept for the shell', css.includes('data-theme="yudark"'))

console.log('')
if (failures.length) {
  console.error(`Theme guard failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log('YuTheme v2 guard: all checks passed.')
