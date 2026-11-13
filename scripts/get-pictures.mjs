#!/usr/bin/env node
// Fetches each word's OpenMoji picture (colour SVG) into public/pictures/<word>.svg and writes
// public/pictures/manifest.json, which the service worker precaches so the pictures work offline.
// Pictures: OpenMoji (https://openmoji.org), CC BY-SA 4.0. Run after adding words to src/content/words.ts:
//   node scripts/get-pictures.mjs           # only the missing ones
//   node scripts/get-pictures.mjs --all     # fetch every picture again

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/pictures')
const SRC = 'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg'

const words = [...readFileSync(join(ROOT, 'src/content/words.ts'), 'utf8').matchAll(/\{ id: '([a-z]+)', openmoji: '([0-9A-F-]+)' \}/g)].map((m) => ({ id: m[1], code: m[2] }))
mkdirSync(OUT, { recursive: true })
const all = process.argv.includes('--all')

for (const w of words) {
  const file = join(OUT, `${w.id}.svg`)
  if (!all && existsSync(file)) continue
  // curl, not fetch: it goes through the environment's proxy settings.
  const svg = execFileSync('curl', ['-sSfL', `${SRC}/${w.code}.svg`], { encoding: 'utf8' }).replace(/<\?xml[^>]*>\s*/, '')
  writeFileSync(file, `<!-- OpenMoji ${w.code} (openmoji.org), CC BY-SA 4.0 -->\n${svg}`)
  console.log(`${w.id}: ${w.code}`)
}

const files = readdirSync(OUT).filter((f) => f.endsWith('.svg')).sort().map((f) => `pictures/${f}`)
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(files, null, 1) + '\n')
console.log(`manifest: ${files.length} pictures`)
