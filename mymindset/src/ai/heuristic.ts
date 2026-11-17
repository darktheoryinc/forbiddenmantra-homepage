/**
 * Local, rule-based ramble analyzer.
 *
 * This is NOT machine learning. It looks for comedic *structure* in what the comedian actually said
 * (turn words, short-after-long rhythm, observation openers, story markers, repeated words) and
 * ranks passages. Every excerpt is verbatim from the transcript; nothing is rewritten.
 * Transitions are templates and are always labeled as suggestions.
 */
import type { AnalysisResult, AnalysisProvider, RawBit, RawCallback, RawRoutine } from './types'
import type { SuggestionKind } from '../lib/types'

const STOP = new Set(
  `a about above after again all also am an and any are aren't as at be because been before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself just let's like me more most mostly my myself no nor not of off on once only or other ought our ours ourselves out over own really same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's will with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves um uh uhh umm yeah okay ok well right gonna wanna kinda sorta got get gets getting go goes going went one two three thing things stuff something anything everything nothing way lot bit guy guys people say said says think know see saw want need come came make made take took good bad even still much many back now never ever always every`
    .split(/\s+/),
)
const FILLERS = /\b(um+|uh+|you know|i mean|like,)\b/gi
const TURN = /\b(but|except|turns out|actually|instead|however|which is|until|apparently|surprise|plot twist|and then|of course|obviously|meanwhile|only to)\b/i
const OBS_OPEN = /\b(you ever notice|have you ever|ever notice|why is|why do|why does|what's the deal|what is the deal|isn't it (weird|crazy|funny)|the (worst|best|weirdest|craziest) part|the thing about|i hate (it )?when|i love how|people who|who decided|is it just me|am i the only)\b/i
const STORY = /\b(so (i|we|my)|last (week|night|month|year)|the other (day|night)|yesterday|one time|a (few|couple of) (days|weeks|years) ago|when i was|my (mom|mother|dad|father|wife|husband|girlfriend|boyfriend|ex|kid|son|daughter|boss|doctor|therapist|friend|brother|sister|grandma|grandmother)|i (went|was|walked|called|told|asked|met|got|tried))\b/i
const EXAGG = /\b(literally|insane|crazy|worst|best ever|never|always|every single|million|billion|disaster|nightmare|terrified|obsessed|furious|hilarious|ridiculous|absurd|unbelievable)\b/i
const FIRST_PERSON = /\b(i|i'm|i've|my|me)\b/i

export interface Segment { text: string; start: number; end: number; words: string[] }

export function tokens(text: string): string[] {
  return (text.toLowerCase().replace(FILLERS, ' ').match(/[a-z][a-z'’-]*/g) ?? []).map((w) => w.replace(/’/g, "'"))
}

export function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && w.endsWith('es') && /(ss|sh|ch|x|z)es$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

export function contentWords(text: string): string[] {
  return tokens(text).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)
}

/** Split into sentence-like segments with offsets; chops runaway un-punctuated speech at commas/conjunctions. */
export function segment(text: string): Segment[] {
  const out: Segment[] = []
  const re = /[^.!?\n]+(?:[.!?]+["')\]]*)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const raw = m[0]
    const lead = raw.length - raw.trimStart().length
    const t = raw.trim()
    if (!t) continue
    const start = m.index + lead
    pushChunked(out, t, start)
  }
  return out
}

function pushChunked(out: Segment[], t: string, start: number) {
  const words = t.split(/\s+/)
  if (words.length <= 40) {
    out.push({ text: t, start, end: start + t.length, words: contentWords(t) })
    return
  }
  // Runaway sentence: cut at the comma / conjunction closest to ~22 words in.
  const cutRe = /(,\s+|\s+(?:and then|and|but|so|because)\s+)/g
  let best = -1
  let bestDist = Infinity
  let m: RegExpExecArray | null
  while ((m = cutRe.exec(t))) {
    const idx = m.index + (m[0].startsWith(',') ? 1 : 0)
    const wordsBefore = t.slice(0, idx).split(/\s+/).length
    const dist = Math.abs(wordsBefore - 22)
    if (dist < bestDist) { bestDist = dist; best = idx }
  }
  if (best <= 0) {
    out.push({ text: t, start, end: start + t.length, words: contentWords(t) })
    return
  }
  const left = t.slice(0, best).trim()
  const right = t.slice(best).trim()
  pushChunked(out, left, start)
  pushChunked(out, right, start + t.indexOf(right, best - 1))
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const A = new Set(a), B = new Set(b)
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

interface Group { segs: Segment[] }

/** Group consecutive segments into "bits": blank-line breaks, topic shifts, or 5-sentence cap end a bit. */
function group(text: string, segs: Segment[]): Group[] {
  const groups: Group[] = []
  let cur: Segment[] = []
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (cur.length) {
      const prev = cur[cur.length - 1]
      const gap = text.slice(prev.end, s.start)
      const paraBreak = /\n\s*\n/.test(gap)
      const window = cur.slice(-2).flatMap((x) => x.words)
      const shift = jaccard(window, s.words) === 0 && !TURN.test(s.text) && s.words.length >= 3 && cur.length >= 2
      if (paraBreak || shift || cur.length >= 5) {
        groups.push({ segs: cur })
        cur = []
      }
    }
    cur.push(s)
  }
  if (cur.length) groups.push({ segs: cur })
  return groups
}

function wc(s: string) { return (s.match(/\S+/g) ?? []).length }

interface Scored { kind: SuggestionKind; score: number; why: string[]; setup?: string; punchline?: string }

function scoreGroup(g: Group): Scored | null {
  const text = g.segs.map((s) => s.text).join(' ')
  const clean = text.replace(FILLERS, ' ')
  const n = wc(clean)
  if (n < 5) return null
  const why: string[] = []
  let score = 0
  const last = g.segs[g.segs.length - 1].text
  const first = g.segs[0].text
  const rest = g.segs.slice(0, -1).map((s) => s.text).join(' ')

  const hasObs = OBS_OPEN.test(text)
  const hasStory = STORY.test(first) && g.segs.length >= 2
  const hasTurn = TURN.test(text)
  const shortLast = wc(last) <= 12 && wc(rest) >= 8 && g.segs.length >= 2
  const question = /\?/.test(first)

  if (hasObs) { score += 0.35; why.push('observation opener') }
  if (hasStory) { score += 0.3; why.push('story marker') }
  if (hasTurn) { score += 0.2; why.push('turn word (the twist)') }
  if (shortLast) { score += 0.25; why.push('short punch after longer setup') }
  if (question && g.segs.length >= 2) { score += 0.1; why.push('question setup') }
  if (EXAGG.test(text)) { score += 0.1; why.push('exaggeration') }
  if (FIRST_PERSON.test(text)) { score += 0.05; why.push('personal angle') }
  if (g.segs.length === 1 && hasTurn && n >= 7 && n <= 30) { score += 0.1; why.push('compact one-liner shape') }
  if (/(\b\w+\b),\s+(\b\w+\b),?\s+(and|or)\s+\b\w+\b/i.test(text)) { score += 0.1; why.push('rule of three') }
  if (n > 120) score -= 0.15

  if (score < 0.3) return null

  let kind: SuggestionKind = 'premise'
  if (hasStory && g.segs.length >= 3) kind = 'story'
  else if (shortLast || (hasTurn && g.segs.length >= 2)) kind = 'setup-punchline'
  else if (hasObs) kind = 'observation'
  else if (g.segs.length === 1) kind = 'premise'

  const out: Scored = { kind, score: Math.min(0.95, score), why }
  if (kind === 'setup-punchline' || kind === 'story') {
    if (g.segs.length >= 2) { out.setup = rest; out.punchline = last }
    else {
      const m = /^(.*?)(?:,|\s)\s*(but|except|until|then|turns out|actually|instead)\s(.*)$/i.exec(text)
      if (m && wc(m[1]) >= 3) { out.setup = m[1].trim(); out.punchline = `${m[2]} ${m[3]}`.trim() }
    }
  }
  return out
}

export function findThemes(segs: Segment[], limit = 6): { theme: string; count: number }[] {
  const freq = new Map<string, number>()
  for (const s of segs) for (const w of new Set(s.words)) freq.set(w, (freq.get(w) ?? 0) + 1)
  return [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([theme, count]) => ({ theme, count }))
}

const TRANSITIONS = [
  (t: string) => `Speaking of ${t} —`,
  (t: string) => `And the ${t} thing doesn't stop there.`,
  (t: string) => `Which brings me back to ${t}.`,
  (t: string) => `Same ${t} energy, different disaster:`,
]
const GENERIC = ['Anyway —', 'Which reminds me:', 'But that\'s not even the worst part.', 'Here\'s where it gets weird:']

/** Template-based bridge between two bits. `variant` cycles alternatives so "regenerate" gives a new take. */
export function suggestTransition(from: string, to: string, variant = 0): string {
  const a = new Set(contentWords(from))
  const shared = contentWords(to).filter((w) => a.has(w))
  if (shared.length) return TRANSITIONS[variant % TRANSITIONS.length](shared[0])
  return GENERIC[variant % GENERIC.length]
}

/** Alternate setup/punchline boundaries within an excerpt (sentence boundaries). */
export function alternateSplit(excerpt: string, variant: number): { setup?: string; punchline?: string; rationale: string } {
  const sentences = excerpt.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [excerpt]
  if (sentences.length < 2) {
    const words = excerpt.split(/\s+/)
    if (words.length < 6) return { rationale: 'Too short to split.' }
    const cut = Math.max(3, Math.min(words.length - 2, Math.round(words.length * (0.5 + 0.15 * ((variant % 3) - 1)))))
    return { setup: words.slice(0, cut).join(' '), punchline: words.slice(cut).join(' '), rationale: 'Split at a different point in the sentence.' }
  }
  const cuts = sentences.length - 1
  const cut = cuts - (variant % cuts)
  return {
    setup: sentences.slice(0, cut).join(' '),
    punchline: sentences.slice(cut).join(' '),
    rationale: `Treated the last ${sentences.length - cut} sentence(s) as the punchline.`,
  }
}

export function analyzeHeuristic(transcript: string): AnalysisResult {
  const text = transcript
  const segs = segment(text)
  if (!segs.length) return { themes: [], bits: [], routines: [], callbacks: [] }
  const themesAll = findThemes(segs)
  const themeSet = new Map(themesAll.map((t) => [t.theme, t.count]))

  const groups = group(text, segs)
  const bits: RawBit[] = []
  for (const g of groups) {
    const sc = scoreGroup(g)
    if (!sc) continue
    const start = g.segs[0].start
    const end = g.segs[g.segs.length - 1].end
    const words = [...new Set(g.segs.flatMap((s) => s.words))]
    const themes = words
      .sort((a, b) => (themeSet.get(b) ?? 0) - (themeSet.get(a) ?? 0) || b.length - a.length)
      .slice(0, 3)
    bits.push({
      kind: sc.kind,
      excerpt: text.slice(start, end),
      start, end,
      setup: sc.setup, punchline: sc.punchline,
      themes,
      confidence: Math.round(sc.score * 100) / 100,
      rationale: `Heuristic signals: ${sc.why.join(', ')}.`,
    })
  }

  // Callbacks: a distinctive word/bigram that surfaces in 2+ separate bits.
  const callbacks: RawCallback[] = []
  const seen = new Map<string, Set<number>>()
  bits.forEach((b, i) => {
    const ws = contentWords(b.excerpt)
    const grams = new Set<string>([...ws, ...ws.slice(1).map((w, k) => `${ws[k]} ${w}`)])
    for (const gm of grams) {
      if (!seen.has(gm)) seen.set(gm, new Set())
      seen.get(gm)!.add(i)
    }
  })
  const claimed = new Set<number>()
  for (const [phrase, idx] of [...seen.entries()].sort((a, b) => b[0].split(' ').length - a[0].split(' ').length || b[1].size - a[1].size)) {
    if (idx.size < 2 || phrase.length < 4) continue
    if (callbacks.length >= 5) break
    const list = [...idx].sort((a, b) => a - b)
    if (list.every((i) => claimed.has(i)) && !phrase.includes(' ')) continue
    list.forEach((i) => claimed.add(i))
    callbacks.push({ phrase, bitIndexes: list })
  }

  // Routines: group bits by their strongest shared theme, ordered as spoken.
  const routines: RawRoutine[] = []
  const used = new Set<number>()
  for (const { theme } of themesAll) {
    const members = bits.map((b, i) => ({ b, i })).filter(({ b, i }) => !used.has(i) && b.themes.includes(theme)).map(({ i }) => i)
    if (members.length < 2) continue
    members.forEach((i) => used.add(i))
    const transitions = members.slice(1).map((idx, k) => suggestTransition(bits[members[k]].excerpt, bits[idx].excerpt, k))
    routines.push({ title: `Routine: ${theme}`, theme, bitIndexes: members, transitions })
  }

  return { themes: themesAll.map((t) => t.theme), bits, routines, callbacks }
}

export const heuristicProvider: AnalysisProvider = {
  id: 'local-heuristic',
  label: 'Local pattern finder',
  origin: 'heuristic-suggested',
  description: 'Runs on your device. Rule-based pattern matching on comedic structure — not an AI model. Never rewrites your words.',
  async analyze({ transcript }) { return analyzeHeuristic(transcript) },
  async regenerate({ excerpt, variant }) { return alternateSplit(excerpt, variant) },
  async suggestTransition({ from, to, variant }) { return suggestTransition(from, to, variant) },
}
