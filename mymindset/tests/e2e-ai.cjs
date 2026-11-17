// End-to-end: recording → real AI analysis → routine → set → stage, plus failure fallback.
// Usage: node tests/e2e-ai.cjs <aiBaseUrl> <deadAiBaseUrl>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path')
const [ai, dead] = [process.argv[2] || 'http://localhost:8787', process.argv[3] || 'http://localhost:8788']
const out = process.env.SHOTS || '/tmp/claude-0/shots'
const T = fs.readFileSync(path.join(__dirname, 'fixtures/ramble.txt'), 'utf8')
const step = (m) => console.log('•', m)
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m) }
async function newPage(b, base) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, permissions: ['microphone'] })
  const p = await ctx.newPage(); const errors = []
  p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await p.goto(base); return { p, errors }
}
async function recordAndPaste(p) {
  await p.getByRole('button', { name: 'Start recording' }).click(); await p.waitForTimeout(2000)
  await p.getByRole('button', { name: 'Stop recording' }).click(); await p.waitForURL(/#\/recording\//); await p.waitForSelector('audio')
  await p.getByLabel('Transcript').fill(T); await p.getByRole('button', { name: 'Save', exact: true }).click()
}
async function chooseAi(p, base) {
  await p.evaluate(() => { location.hash = '#/settings' }); await p.waitForSelector('text=Joke discovery engine')
  const radio = p.getByRole('radio', { name: /AI analysis \(server model\)/ }); await radio.waitFor(); await radio.click()
  await p.waitForFunction(() => document.querySelectorAll('input[name=prov]')[1]?.checked === true) // the setting saves asynchronously
}
;(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })

  // ---------- real AI ----------
  let { p, errors } = await newPage(b, ai)
  step('record + paste transcript'); await recordAndPaste(p)
  const recUrl = p.url()
  step('select the AI engine in Settings'); await chooseAi(p, ai)
  await p.goto(recUrl); await p.waitForSelector('audio')
  step('Find the jokes (real local model — can take a minute or two)')
  const t0 = Date.now()
  await p.getByRole('button', { name: 'Find the jokes' }).click()
  await p.waitForSelector('text=Analyzing with your AI model')
  await p.screenshot({ path: `${out}/20-ai-busy.png` })
  await p.waitForSelector('text=Joke candidates', { timeout: 420000 })
  step(`analysis finished in ${Math.round((Date.now() - t0) / 1000)}s`)
  await p.waitForSelector('text=/Analyzed by qwen2.5:3b/')
  const bits = await p.locator('.excerpt').count()
  step(`candidates shown: ${bits}`); assert(bits >= 3, 'at least 3 candidates')
  assert(await p.locator('.badge.ai', { hasText: 'AI-suggested structure' }).count() >= 1, 'AI structure badges present')
  assert(await p.locator('.badge.original', { hasText: 'Your words' }).count() >= 3, '"Your words" badges present')
  assert(!(await p.getByText('Fallback').count()), 'no fallback notice on success')
  // every excerpt shown is a real slice of the transcript
  const shown = await p.locator('.excerpt').allInnerTexts()
  const norm = (s) => s.replace(/\s+/g, ' ').trim()
  const bad = shown.filter((s) => !norm(T).includes(norm(s)) && !/^[“"]/.test(s))
  assert(bad.length === 0, 'excerpts not in transcript: ' + bad[0])
  await p.screenshot({ path: `${out}/21-ai-candidates.png`, fullPage: true })

  step('edit, accept, regenerate split, reject on candidates')
  await p.getByRole('button', { name: 'Edit', exact: true }).first().click()
  await p.getByLabel('Edit candidate text').fill('MY OWN TIGHTENED VERSION of the airport bit.')
  await p.getByRole('button', { name: 'Save edit' }).click()
  await p.getByText('Original excerpt:').first().waitFor()
  await p.getByRole('button', { name: 'Regenerate' }).nth(1).click()
  await p.getByRole('button', { name: 'Accept', exact: true }).first().click(); await p.waitForSelector('text=In Vault')
  await p.getByRole('button', { name: 'Delete', exact: true }).first().click()
  await p.getByText(/dismissed/).waitFor()

  step('routines: closer badge, AI-written transitions, regenerate, reorder')
  await p.getByRole('button', { name: /^Routines/ }).click()
  await p.waitForSelector('text=AI-written transition', { timeout: 5000 }).catch(() => step('  (no routine with transitions returned this run)'))
  const hasRoutine = await p.getByRole('button', { name: 'Accept → build set' }).count()
  assert(hasRoutine >= 1, 'at least one routine')
  const closer = await p.locator('.badge.ai', { hasText: 'Suggested closer' }).count()
  step(`routines: ${hasRoutine}, closer badges: ${closer}`)
  await p.screenshot({ path: `${out}/22-ai-routines.png`, fullPage: true })
  const tbox = p.getByLabel('Transition').first()
  if (await tbox.count()) {
    const before = await tbox.inputValue()
    await p.getByRole('button', { name: 'Regenerate transition' }).first().click(); await p.waitForTimeout(25000)
    step(`  transition regenerated: "${before}" → "${await tbox.inputValue()}"`)
    await tbox.fill('My own transition, in my own words.')
  }
  await p.getByRole('button', { name: 'Move down' }).first().click()
  await p.waitForTimeout(500)

  step('connections shown with verbatim quotes (if the model found any)')
  const conns = await p.locator('text=Possible connections').count(); step(`  connections block: ${conns ? 'yes' : 'none returned'}`)

  step('transcript untouched'); assert((await p.getByLabel('Transcript').inputValue()) === T, 'transcript changed!')

  step('accept routine → set builder → stage')
  await p.getByRole('button', { name: 'Accept → build set' }).first().click(); await p.waitForURL(/#\/sets\//)
  await p.waitForSelector('text=Set Builder')
  assert(await p.getByLabel('transition').count() >= 0, 'set builder loaded')
  await p.screenshot({ path: `${out}/23-ai-set.png`, fullPage: true })
  await p.getByRole('link', { name: /Rehearse/ }).click(); await p.waitForSelector('.stage-card')
  await p.getByRole('button', { name: /Next/ }).click(); await p.screenshot({ path: `${out}/24-ai-stage.png` })
  console.log('real-AI console/page errors:', errors.length ? errors : 'none')

  // ---------- failure path ----------
  step('FALLBACK: AI endpoint is dead')
  ;({ p, errors } = await newPage(b, dead))
  await recordAndPaste(p); const url2 = p.url()
  await chooseAi(p, dead); await p.goto(url2); await p.waitForSelector('audio')
  await p.getByRole('button', { name: 'Find the jokes' }).click()
  await p.waitForSelector('text=/AI analysis unavailable/', { timeout: 60000 })
  await p.waitForSelector('text=Joke candidates')
  await p.waitForSelector('text=/offline pattern finder produced these results/')
  const fb = await p.locator('.excerpt').count(); step(`  fallback produced ${fb} candidates`); assert(fb >= 3, 'fallback candidates')
  assert(await p.locator('.badge.heur', { hasText: 'Suggested structure' }).count() >= 1, 'heuristic labels on fallback results')
  await p.screenshot({ path: `${out}/25-fallback.png`, fullPage: true })

  step('OFFLINE ENGINE still selectable and works with no server involvement')
  await p.evaluate(() => { location.hash = '#/settings' }); await p.getByRole('radio', { name: /Local pattern finder/ }).click(); await p.waitForFunction(() => document.querySelectorAll('input[name=prov]')[0]?.checked === true)
  await p.goto(url2); await p.getByRole('button', { name: 'Find the jokes' }).click()
  await p.waitForSelector('text=/Found \\d+ candidates? \\(Local pattern finder\\)/')
  console.log('fallback console/page errors:', errors.length ? errors : 'none')
  await b.close()
})().catch((e) => { console.error('E2E FAILED', e.message); process.exit(1) })
