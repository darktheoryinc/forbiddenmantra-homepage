#!/usr/bin/env node
// Prioritised missing-cover report for owner-owned (owner-listed) works.
//   node scripts/cover-needs.mjs      writes data/drafts/covers-needed-prioritized.json and docs/COVER-RECOVERY-PLAN.md
// Nothing here fetches an image. "Distinct designs" counts one design per (work, language): translations carry different cover text, and
// the formats of one title are ASSUMED (not proven) to share their front artwork until the owner confirms.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const cat = J('data/catalogue.json'), covers = J('data/covers.json').covers, HL = J('data/highlights.json');
const langs = new Map(J('data/languages.json').languages.map((l) => [l.code, l.name]));
const have = new Set(covers.map((c) => `${c.work}/${c.edition}`));
const hasCover = (w) => w.editions.some((e) => have.has(`${w.slug}/${e.id}`));
const fmpWorks = cat.works.filter((w) => w.press === 'fmp');
const order = new Map((HL.featured ?? []).map((s, i) => [s, i]));
const shelf = [...fmpWorks].sort((a, b) => (order.has(a.slug) ? order.get(a.slug) : 99) - (order.has(b.slug) ? order.get(b.slug) : 99) || (hasCover(b) ? 1 : 0) - (hasCover(a) ? 1 : 0)).slice(0, 14).map((w) => w.slug);
const moPai = new Set([...(HL.moPai.order ?? []), ...cat.works.filter((w) => w.subjects.includes(HL.moPai.subject)).map((w) => w.slug)]);
const pressPos = new Map(fmpWorks.map((w, i) => [w.slug, i])), onPressPage1 = (w) => pressPos.get(w.slug) < 48; // first page of the Press listing (48 cards)
const home = (w) => (shelf.includes(w.slug) ? 'homepage: Featured from Forbidden Mantra Press shelf' : moPai.has(w.slug) ? 'homepage: Mo Pai Collection shelf' : null);
const own = cat.works.filter((w) => w.status === 'owner-listed' && !hasCover(w));
const rows = own.map((w) => {
  const byLang = {};
  for (const e of w.editions) (byLang[e.language] ??= []).push(e);
  const hasPrint = w.editions.some((e) => ['paperback', 'hardcover'].includes(e.format));
  const eds = w.editions.map((e) => ({ language: e.language, format: e.format, asin: e.asin ?? null, isbn13: e.isbn13 ?? null, link: (e.retailers ?? []).some((r) => r.kind === 'product') ? 'product link from the owner catalogue (live check pending)' : 'search link only' }));
  const tier = home(w) ? 1 : w.press && w.editions.some((e) => e.language === 'en') ? 2 : w.press ? 3 : 4;
  return { tier, tierName: ['', 'Highest visibility (on the homepage)', 'Forbidden Mantra Press titles with product links (English)', 'Forbidden Mantra Press translations and other languages', 'Imprint or author identity unresolved (not counted as press titles)'][tier],
    work: w.slug, title: w.title, subtitle: w.subtitle || null, credit: w.authors[0], press: !!w.press, shownOn: home(w) ?? (onPressPage1(w) ? 'first page of the Press listing' : null), designs: Object.keys(byLang).map((l) => ({ language: l, languageName: langs.get(l) ?? l, formats: byLang[l].map((e) => e.format), asins: byLang[l].map((e) => e.asin) })),
    editions: eds, editionCount: eds.length, hasPrintEditions: hasPrint,
    sourceFileNeeded: `Original front-cover file for each design above (portrait, at least 1000 px on the short side if possible). Say which formats use the same artwork; the ebook file is enough to show on the book card.` };
}).sort((a, b) => a.tier - b.tier || (b.shownOn ? 1 : 0) - (a.shownOn ? 1 : 0) || b.editionCount - a.editionCount || a.title.localeCompare(b.title));
// works that already have a cover for one language but not for their other-language editions
const partial = cat.works.filter((w) => w.status === 'owner-listed' && hasCover(w)).flatMap((w) => [...new Set(w.editions.map((e) => e.language))].filter((l) => !w.editions.some((e) => e.language === l && have.has(`${w.slug}/${e.id}`))).map((l) => ({ work: w.slug, title: w.title, language: l, languageName: langs.get(l) ?? l, asins: w.editions.filter((e) => e.language === l).map((e) => e.asin) })));
const designs = rows.flatMap((r) => r.designs.map((d) => ({ ...d, work: r.work })));
const byLang = {};
for (const d of designs) byLang[d.language] = (byLang[d.language] ?? 0) + 1;
const tiers = [1, 2, 3, 4].map((t) => ({ tier: t, works: rows.filter((r) => r.tier === t).length, designs: rows.filter((r) => r.tier === t).reduce((n, r) => n + r.designs.length, 0), editions: rows.filter((r) => r.tier === t).reduce((n, r) => n + r.editionCount, 0) }));
const reuseFile = path.join(ROOT, 'data/cover-reuse.json'), displayReuse = fs.existsSync(reuseFile) ? (JSON.parse(fs.readFileSync(reuseFile, 'utf8')).reuse ?? []).length : 0;
const summary = { displayReuseEditions: displayReuse, generated: new Date().toISOString().slice(0, 10), worksMissing: rows.length, editionsInThoseWorks: rows.reduce((n, r) => n + r.editionCount, 0), distinctDesigns: designs.length, otherLanguageDesignsOfCoveredWorks: partial.length, designsByLanguage: byLang, tiers, note: 'One design per (work, language). Formats of the same title are assumed, not proven, to share front artwork.' };
fs.writeFileSync(path.join(ROOT, 'data/drafts/covers-needed-prioritized.json'), JSON.stringify({ summary, works: rows, otherLanguageEditionsOfCoveredWorks: partial }, null, 1) + '\n');
const tbl = (rs) => rs.map((r) => `| ${r.title.replace(/\|/g, '/')}${r.subtitle ? ': ' + r.subtitle.slice(0, 40) : ''} | ${r.credit} | ${r.designs.map((d) => `${d.languageName}: ${d.formats.join('/')}`).join('; ')} | ${[...new Set(r.designs.flatMap((d) => d.asins).filter(Boolean))].slice(0, 6).join(', ')} |`).join('\n');
let md = `# Cover recovery plan (${summary.generated})\n\nGenerated by \`scripts/cover-needs.mjs\`. No image is fetched. Amazon-hosted images are not used (see AMAZON-COVERS.md).\n\n## How many distinct designs are missing\n- ${summary.worksMissing} owner-listed works have no cover, with ${summary.editionsInThoseWorks} editions between them.\n- That is **${summary.distinctDesigns} distinct designs** if each (work, language) is one design and the formats of a title share front artwork. Translations always need their own file because the cover text differs.\n- By language: ${Object.entries(byLang).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${langs.get(l) ?? l} ${n}`).join(', ')}.\n- By priority: ${tiers.map((t) => `tier ${t.tier}: ${t.works} works / ${t.designs} designs / ${t.editions} editions`).join('; ')}.\n- Another **${partial.length} designs** are other-language editions of works that already have a cover in one language (for example the German, Dutch, Welsh and Spanish Apocalypse of Adam); they are listed in the JSON under otherLanguageEditionsOfCoveredWorks.\n- The format assumption is not proven by any file we hold; the owner's catalogue shows one cover per record, which is consistent with it, but only the owner can confirm identical artwork.\n\n`;
for (const t of [1, 2, 3, 4]) { const rs = rows.filter((r) => r.tier === t); md += `## Tier ${t}: ${rs[0]?.tierName ?? ''} (${rs.length})\n| Title | Credit | Designs (language: formats) | ASINs |\n|---|---|---|---|\n${tbl(rs)}\n\n`; }
md += `## What each file needs to be\nThe original front cover as supplied to the publishing platform (PNG or JPEG, portrait, ideally 1000 px or wider), named by title and language; for each design say which formats share it. Send ebook artwork first: it is enough for the book cards and the book page.\n`;

md += `\n## Where original artwork was and was not found (2026-10-28)\n- Git history (78 commits, every branch): the only images are our own site, brand, screenshot and cover files already in the manifest. Branch \`main\` holds the old one-file homepage, its Velo snippet and a 7.8 KB ZIP of the same two files; the homepage drew placeholder covers in CSS and contains no cover artwork.\n- Project folders and the machine: no PSD, EPUB, KPF or cover PDF.\n- Wix: the main site's subfolders hold only social-media images; the owner's other Wix sites hold photographs and one Amazon author-page screenshot (Amazon-hosted images, not usable). Google Drive: searched earlier and again this round; no further matches.\n- Conclusion: the remaining artwork is not in any location available to this project. It lives where the books were published (the KDP dashboard or the original design files), so it has to come from the owner.\n\n## Can an ebook cover stand in for the other formats?\n- The site already shows one cover per work on cards and the book page, chosen from whichever edition has one, and each cover is stored against the single edition it was matched to. Page text now states which edition the cover belongs to ("Cover of the English ebook edition; other editions may use different artwork") so it does not claim to be the paperback or hardcover.\n- Nothing we hold proves that paperback, hardcover or audiobook artwork is identical: print covers are separate full-wrap files, and an audiobook cover is square. So no cover has been recorded as belonging to another format. The owner's catalogue showing one cover per record is consistent with shared front artwork but is not proof.\n- If the owner confirms that specific titles use identical front artwork in print, those editions can be added to the manifest with that confirmation as evidence. Audiobooks should have their own square files.\n`;
fs.writeFileSync(path.join(ROOT, 'docs/COVER-RECOVERY-PLAN.md'), md);
console.log(JSON.stringify(summary));
