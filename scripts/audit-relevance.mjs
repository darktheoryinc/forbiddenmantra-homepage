#!/usr/bin/env node
// Read-only relevance audit of works added by a catalogue expansion. Removes nothing: it writes a review list (JSON + CSV + Markdown summary) for the owner.
// usage: node scripts/audit-relevance.mjs <previous-catalogue.json> [--harvest staging/harvest5,staging/harvest3] [--out staging/review/relevance-audit]
import fs from 'fs'; import readline from 'readline';
const args = process.argv.slice(2); const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const prevFile = args.find((a) => !a.startsWith('--') && a !== flag('--harvest') && a !== flag('--out'));
const harvests = (flag('--harvest', 'staging/harvest5,staging/harvest3,staging/harvest4,staging/harvest2,staging/harvest')).split(',');
const outBase = flag('--out', 'staging/review/relevance-audit');
const prev = JSON.parse(fs.readFileSync(prevFile, 'utf8')); const cat = JSON.parse(fs.readFileSync('data/catalogue.json', 'utf8'));
const oldSlugs = new Set(prev.works.map((w) => w.slug)); const oldAuthors = new Set(prev.works.flatMap((w) => w.authors));
const added = cat.works.filter((w) => !oldSlugs.has(w.slug));
const wanted = new Set(added.map((w) => w.provenance?.workKey)); const subj = new Map();
for (const d of harvests) { const f = `${d}/openlibrary.jsonl`; if (!fs.existsSync(f)) continue;
  for await (const l of readline.createInterface({ input: fs.createReadStream(f) })) { let r; try { r = JSON.parse(l); } catch { continue; } if (!wanted.has(r.workKey)) continue;
    const e = subj.get(r.workKey) || new Set(); [...(r.olSubjects || []), ...(r.subjects || [])].forEach((s) => e.add(s.toLowerCase())); subj.set(r.workKey, e); } }

// --- evidence vocabularies (deliberately conservative: anything with real esoteric / religious evidence is protected) ---
const STRONG = /\b(yoga|yogi|tantra|tantric|mantra|chakra|kundalini|pranayama|meditat|mindful|vedic|veda|vedanta|upanishad|bhagavad|gita|sutra|sanskrit|hindu|hinduism|buddh|zen|dharma|tibetan|taoi|daoi|tao te|i ching|gnostic|nag hammadi|hermetic|hermes trismegistus|alchem|occult|esoteric|mystic|theosoph|anthroposoph|rosicruc|kabbal|qabal|cabal|tarot|astrolog|divination|grimoire|goetia|solomon|enochian|thelema|crowley|witchcraft|wicca|pagan|druid|shaman|magick|ritual magic|ceremonial|spiritual|spirituality|sacred|goddess|mytholog|folklore|folk tale|legend|religio|theolog|scripture|apocryph|pseudepigrapha|egypt|sufi|mysticism|psychic|clairvoy|reincarnat|karma|siddha|guru|swami|ashram|consciousness|enlighten|angel|demon|amulet|talisman|sigil|runes?|norse|celtic|dream|aura|reiki|energy healing|subtle bod|vajrayana|mahayana|theravada|jain|sikh|tao|qigong|qi gong|tai chi|feng shui|ayurved|paranormal investigation|ufo|metaphys|new thought|spiritualism|seance|gospel|bible|biblical|testament|church|christian|jesus|catholic|islam|jewish|judaism|santeria|voodoo|vodou|hoodoo|cathar|templar|panchatantra|jataka|dead sea|emerald tablet|jubilees|enoch|assyr|babylon|sumer|mesopotam|pharaoh|prayer|pray|healing|prophe|oracle|kaballah|zohar|torah|talmud|quran|koran|monast|mythic|hero myth|archetype|jung|esoter|secret societ|illuminati|freemason|atlantis|lemuria|hollow earth|cryptid|bigfoot|incense|herbal|tree of life|cosmolog|nondual|advaita|bhakti|krishna|shiva|vishnu|ramayana|mahabharata|purana|rig ?veda|indian philosophy|asian religions|astral|plotinus|neoplaton|iamblichus|proclus|rootwork|conjure|santer|palo mayombe|candomble|obeah|near-death|near death|levitat|telepath|miracle|kamasutra|kama sutra|kama-sutra|paranormal|out-of-body|apparition|reincarnation|afterlife|life after death)/i;
const FICTIONISH = /\bfiction\b|\bnovels?\b|\bstor(?:y|ies)\b|juvenile|romance|comics?\b|graphic novel|young adult|children|humou?r|\bmystery\b|\bthrillers?\b|detective|adventure|fairy tales?|picture book|\breaders\b|cartoon|erotic|\bvampires?\b|werewol|\bhorror\b|\bsuspense\b|\bcrime\b/i;
const JUVENILE = /juvenile|children's|young adult|picture book|early reader|easy reader|chapter book|\bgrades?\b|\bages? \d|\breaders\b|board book/i;
const COMMERCIAL = /romance|mystery|detective|thriller|suspense|\bcrime\b|police procedural|historical fiction|fiction, historical|science fiction|space opera|\bwesterns?\b|war stories|\bspy\b|chick lit|erotic|humou?r|\bcomics?\b|graphic novel|\bcozy\b|\bcosy\b|action & adventure|medical fiction|domestic fiction|love stor|christmas stories/i;
const WEAK_GENRE = /exorcis|beltane|samhain|imbolc|lughnasadh|sabbat|\bsoul|\bspirit|fantasy|magic|witch|wizard|dragon|vampire|ghost|supernatural|paranormal|fairy|fairies|haunted|occult|horror|werewol|angels?|demons?|myth|legend|folk/i;

const rows = [];
for (const w of added) {
  const raw = [...(subj.get(w.provenance?.workKey) || [])];
  const fic = raw.filter((s) => FICTIONISH.test(s)); const nonfic = raw.filter((s) => !FICTIONISH.test(s));
  const titleText = `${w.title} ${w.subtitle || ''}`;
  const strongTitle = STRONG.test(titleText); const strongSub = nonfic.filter((s) => STRONG.test(s));
  const weak = WEAK_GENRE.test(titleText) || raw.some((s) => WEAK_GENRE.test(s));
  const juvenile = raw.some((s) => JUVENILE.test(s)); const commercial = raw.some((s) => COMMERCIAL.test(s));
  const authorKnown = w.authors.some((a) => oldAuthors.has(a));
  const ficShare = raw.length ? fic.length / raw.length : 0;
  let verdict = 'keep'; let reason = '';
  const evidence = strongTitle || strongSub.length > 0;
  const ficEvidence = !evidence && fic.some((x) => STRONG.test(x));
  if (!raw.length) { if (!strongTitle) { verdict = 'uncertain'; reason = 'no subject headings available and no esoteric/religious signal in the title'; } }
  else if (fic.length > 0 && strongTitle && !strongSub.length && (juvenile || commercial)) { verdict = 'uncertain'; reason = `${juvenile ? "children's" : 'genre'} fiction matched only on a keyword in the title (${fic.slice(0, 3).join('; ')})`; }
  else if (fic.length > 0 && ficEvidence) { verdict = 'uncertain'; reason = `fiction whose subject headings carry an esoteric/religious theme (${fic.filter((x) => STRONG.test(x)).slice(0, 3).join('; ')})`; }
  else if (fic.length > 0 && !evidence) {
    if ((juvenile || commercial) && !weak && !/\b(myth|legend|folk|tales?)\b/i.test(titleText)) { verdict = 'exclude'; reason = `${juvenile ? "children's/young-adult" : 'commercial genre'} fiction with no esoteric, religious or folklore evidence (${fic.slice(0, 3).join('; ')})`; }
    else if (juvenile || commercial) { verdict = 'uncertain'; reason = `${juvenile ? "children's" : 'genre'} fiction that touches magic/fantasy/supernatural themes (${fic.slice(0, 3).join('; ')})`; }
    else if (weak) { verdict = 'uncertain'; reason = `general/fantasy fiction with weak supernatural theme only (${fic.slice(0, 3).join('; ')})`; }
    else { verdict = 'exclude'; reason = `general fiction with no esoteric, religious or folklore evidence (${fic.slice(0, 3).join('; ')})`; }
  } else if (!evidence && !weak) { verdict = 'uncertain'; reason = 'non-fiction but no esoteric / religious / folklore signal in title or subjects'; }
  else if (!evidence && weak && !fic.length) { verdict = 'keep'; }
  // an author already represented in the original catalogue is never auto-proposed for exclusion
  if (verdict === 'exclude' && authorKnown) { verdict = 'uncertain'; reason += ' [author already has works in the original catalogue]'; }
  // a work with >= 4 editions in the catalogue and any juvenile flag stays 'exclude' only if clearly commercial; nothing else changes.
  rows.push({ verdict, reason, title: w.title, subtitle: w.subtitle || '', authors: w.authors.join('; '), url: `/books/${w.slug}/`, slug: w.slug, editions: w.editions.length, year: w.editions[0]?.year ?? '', subjects: raw.slice(0, 6).join(' | '), department: (w.subjects || []).join(';') });
}
const counts = rows.reduce((c, r) => (c[r.verdict] = (c[r.verdict] || 0) + 1, c), {});
fs.mkdirSync(outBase.split('/').slice(0, -1).join('/') || '.', { recursive: true });
const rank = { exclude: 0, uncertain: 1, keep: 2 };
const review = rows.filter((r) => r.verdict !== 'keep').sort((a, b) => rank[a.verdict] - rank[b.verdict] || a.title.localeCompare(b.title));
fs.writeFileSync(`${outBase}.json`, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), baseCommit: 'fe767c1', note: 'Review list only. Nothing has been removed.', counts, total: rows.length, items: review }, null, 1));
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
fs.writeFileSync(`${outBase}.csv`, ['verdict,title,authors,url,reason,editions,year,open_library_subjects', ...review.map((r) => [r.verdict, r.title, r.authors, r.url, r.reason, r.editions, r.year, r.subjects].map(q).join(','))].join('\n'));
console.log(JSON.stringify({ total: rows.length, ...counts }));

// ---- human-readable report: every proposed exclusion in full, uncertain works grouped by reason (full list is in the CSV/JSON) ----
{
  const md = []; const ex = review.filter((r) => r.verdict === 'exclude'); const un = review.filter((r) => r.verdict === 'uncertain');
  const cell = (s) => String(s).replace(/\|/g, '/').replace(/\s+/g, ' ');
  md.push(`# Relevance review - works added in the expansion (base commit fe767c1)`, '', `**Review list only. Nothing has been removed.** ${rows.length} works were audited.`, '',
    `| Verdict | Works |`, `|---|---|`, `| Propose to exclude | ${counts.exclude || 0} |`, `| Uncertain (needs your decision) | ${counts.uncertain || 0} |`, `| Keep | ${counts.keep || 0} |`, '',
    `## Proposed exclusions (${ex.length})`, '', `| Title | Author | URL | Reason |`, `|---|---|---|---|`,
    ...ex.map((r) => `| ${cell(r.title)} | ${cell(r.authors)} | \`${r.url}\` | ${cell(r.reason.replace(/ with no esoteric, religious or folklore evidence/, ''))} |`), '',
    `## Uncertain works by reason (${un.length}; complete list with URLs in the CSV)`, '');
  const groups = new Map(); for (const r of un) { const k = r.reason.replace(/\s*\(.*$/, '').replace(/\s*\[.*$/, '').trim(); (groups.get(k) || groups.set(k, []).get(k)).push(r); }
  for (const [k, g] of [...groups].sort((a, b) => b[1].length - a[1].length)) md.push(`### ${k} - ${g.length}`, '', ...g.slice(0, 12).map((r) => `- ${cell(r.title)} - ${cell(r.authors)} (\`${r.url}\`)`), g.length > 12 ? `- ...and ${g.length - 12} more` : '', '');
  fs.writeFileSync(`${outBase}.md`, md.join('\n'));
}
