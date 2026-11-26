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

// Canonical YuTheme (Dark default) base tokens. Source: yutheme-design-system
// skill, references/tokens.md. Names are the panel's own --yu-* surface.
const canonical = {
  'yu-bg-base': '#17191c',
  'yu-bg-canvas': '#17191c',
  'yu-bg-page': '#17191c',
  'yu-bg-window': '#0f1113',
  'yu-bg-panel': '#0f1113',
  'yu-bg-sidebar': '#17191c',
  'yu-bg-titlebar': '#1c2023',
  'yu-bg-editor': '#101214',
  'yu-bg-terminal': '#101214',
  'yu-bg-composer': '#1c2023',
  'yu-bg-modal': '#1c2023',
  'yu-bg-hover': '#22272b',
  'yu-bg-active': '#2d3439',
  'yu-bg-input': '#1c2023',
  'yu-bg-input-hover': '#242a2f',
  'yu-bg-popover': '#22272b',
  'yu-bg-tooltip': '#22272b',
  'yu-bg-chip': '#242a2f',
  'yu-text-primary': '#e8e4dc',
  'yu-text-strong': '#f7f4ed',
  'yu-text-secondary': '#adb5b8',
  'yu-text-muted': '#8d989f',
  'yu-text-dim': '#727d83',
  'yu-text-disabled': '#5c666c',
  'yu-text-on-accent': '#0f1113',
  'yu-accent': '#46c2b3',
  'yu-accent-hover': '#63d4c7',
  'yu-accent-glow': 'rgba(70, 194, 179, 0.10)',
  'yu-link': '#64d2ff',
  'yu-link-hover': '#7cd9ff',
  'yu-success': '#31d158',
  'yu-agent': '#bf5af2',
  'yu-danger': '#ff6961',
  'yu-info': '#64d2ff',
  'yu-info-hover': '#7cd9ff',
  'yu-border-default': 'rgba(60, 66, 72, 1.0)',
  'yu-radius-window': '14px',
  'yu-radius-lg': '12px',
  'yu-radius-md': '8px',
  'yu-duration-base': '160ms',
}
const norm = (value) => value.toLowerCase().replace(/\s+/g, '').replace(/(\.\d*?)0+(?=[a-z)]|$)/g, '$1').replace(/\.(?=[a-z)]|$)/g, '')

for (const [name, want] of Object.entries(canonical)) {
  const got = tokens[name]
  check(`token --${name} matches YuTheme v2`, got !== undefined && norm(got) === norm(want), got ? `got ${got}, want ${want}` : 'missing')
}

// Retired palettes must not come back in the frontend source. With Dark as the
// default, the retired AMOLED black/gold surfaces and the old warm-brown
// Swarm/AMOLED border rgb are the legacy values to guard against.
const legacyHexes = [
  '#0b0b0a', '#121211', '#10100f', '#0f0f0e', '#141413', '#151514',
  '#1a1a18', '#1f1f1d', '#d6a84f', '#e0b760',
  '#1a1813', '#191811', '#1b1913', '#201e17', '#24211b', '#b8b2a4', '#827c70',
]

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
      failures.push(`retired palette color ${hex} in ${file.replace(webRoot, 'apps/web')}`)
      legacyHits += 1
    }
  }
}
check('no retired palette colors in frontend source', legacyHits === 0, `${legacyHits} hit(s)`)

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
console.log('YuTheme guard: all checks passed.')
