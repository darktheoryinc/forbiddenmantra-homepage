// Manual end-to-end walk-through against a running server (npm start). Usage: node tests/e2e.cjs [baseUrl]
const { chromium } = require('playwright')
const base = process.argv[2] || 'http://localhost:8787'
const out = process.env.SHOTS || '/tmp/claude-0/shots'
const RAMBLE = `So I went to the airport yesterday and the security guy asks me if I packed my own bag. Who else is packing my bag? My mother? She's been dead since 2009, but sure, she did it. Airports are basically a place where adults get treated like toddlers with luggage.

You ever notice airport pretzels cost eleven dollars? It's a pretzel, it's flour and regret. I paid it, because I'm a coward at the airport, but still.

My mother, God rest her, hated flying. She said if God wanted us to fly he'd have given us better snacks at the gate. Turns out she was right about the pretzels.

Anyway, dating apps are the same. You swipe, you wait, you pay too much for something stale. Why is every profile a picture of a fish? I have never once wanted to date a fish.`
const step = (m) => console.log('•', m)
;(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, permissions: ['microphone'] })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', (e) => errors.push(String(e)))
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await p.goto(base)
  await p.screenshot({ path: `${out}/1-capture.png` })

  step('record with fake mic')
  await p.getByRole('button', { name: 'Start recording' }).click()
  await p.waitForTimeout(2500)
  await p.getByRole('button', { name: 'Stop recording' }).click()
  await p.waitForURL(/#\/recording\//)
  await p.waitForSelector('audio')
  step('audio saved + player present')

  step('paste transcript into recording, find jokes')
  await p.getByLabel('Transcript').fill(RAMBLE)
  await p.getByRole('button', { name: 'Find the jokes' }).click()
  await p.waitForSelector('text=Joke candidates')
  await p.screenshot({ path: `${out}/2-candidates.png`, fullPage: true })
  const cards = await p.locator('.excerpt').count()
  step(`candidates: ${cards}`)

  step('edit + regenerate + accept first candidate')
  await p.getByRole('button', { name: 'Edit', exact: true }).first().click()
  await p.getByLabel('Edit candidate text').fill('You ever notice airport pretzels cost eleven dollars? It is flour and regret.')
  await p.getByRole('button', { name: 'Save edit' }).click()
  await p.getByRole('button', { name: 'Accept', exact: true }).first().click()
  await p.waitForSelector('text=In Vault')

  step('routines tab → accept routine → set builder')
  await p.getByRole('button', { name: /^Routines/ }).click()
  await p.screenshot({ path: `${out}/3-routines.png`, fullPage: true })
  const hasRoutine = await p.getByRole('button', { name: 'Accept → build set' }).count()
  step(`routines: ${hasRoutine}`)
  if (hasRoutine) {
    await p.getByRole('button', { name: 'Accept → build set' }).first().click()
    await p.waitForURL(/#\/sets\//)
  }
  await p.waitForSelector('text=Set Builder')
  await p.screenshot({ path: `${out}/4-setbuilder.png`, fullPage: true })

  step('suggest transitions, save version')
  await p.getByRole('button', { name: 'Suggest transitions' }).click()
  await p.getByRole('button', { name: /^Save v/ }).click()
  await p.waitForSelector('text=Saved as version')

  step('stage mode')
  await p.getByRole('link', { name: /Rehearse/ }).click()
  await p.waitForSelector('.stage-card')
  await p.getByRole('button', { name: 'Start' }).click()
  await p.getByRole('button', { name: /Next/ }).click()
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${out}/5-stage.png` })
  await p.getByRole('link', { name: /Exit/ }).click()

  step('vault + search')
  await p.getByRole('link', { name: 'Vault' }).click()
  await p.getByLabel('Search').fill('pretzel')
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${out}/6-vault.png`, fullPage: true })

  step('log a show')
  await p.getByRole('link', { name: 'Shows' }).click()
  await p.getByRole('button', { name: '+ Log show' }).click()
  await p.getByLabel('Venue').fill('The Cellar')
  await p.locator('#ps').selectOption({ index: 1 })
  await p.getByLabel('Actual time (m:ss)').fill('4:45')
  await p.getByLabel('Audience response').fill('Pretzel line killed.')
  await p.getByRole('button', { name: 'Save', exact: true }).click()
  await p.waitForSelector('text=The Cellar')
  await p.screenshot({ path: `${out}/7-shows.png` })

  step('trend radar (live)')
  await p.getByRole('link', { name: 'Radar' }).click()
  await p.getByRole('button', { name: 'Refresh' }).click()
  await p.waitForSelector('text=Google News RSS', { timeout: 20000 }).catch(() => step('radar: no results shown'))
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${out}/8-radar.png` })

  step('settings')
  await p.goto(base + '/#/settings'); await p.waitForSelector('text=Joke discovery engine')
  await p.screenshot({ path: `${out}/9-settings.png`, fullPage: true })

  console.log('console/page errors:', errors.length ? errors : 'none')
  await b.close()
})().catch((e) => { console.error('E2E FAILED', e); process.exit(1) })
