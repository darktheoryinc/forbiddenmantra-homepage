// Source adapters. Each turns a source's response into the common record shape:
//   { source, sourceId, workKey, title, subtitle, authors[], publisher, year, language, format, isbn13, subjects[], series, url, fetchedAt }
// Descriptions, covers, prices and ratings are deliberately never copied (see config/sources.json policy).
import { toIsbn13 } from './lib.mjs';

const LANG3 = { eng: 'en', spa: 'es', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', por: 'pt', ita: 'it', ara: 'ar', hin: 'hi', san: 'sa', lat: 'la', grc: 'grc', gre: 'el', rus: 'ru', jpn: 'ja', chi: 'zh', zho: 'zh', tib: 'bo', bod: 'bo', pli: 'pi', heb: 'he', per: 'fa', fas: 'fa', tur: 'tr', dut: 'nl', nld: 'nl', swe: 'sv', pol: 'pl', kor: 'ko' };
const FORMAT = [[/audio/i, 'audiobook'], [/e-?book|kindle|electronic|digital/i, 'ebook'], [/hard/i, 'hardcover'], [/paper|trade|mass market|softcover|soft cover/i, 'paperback']];
const mapFormat = (s) => FORMAT.find(([re]) => re.test(s ?? ''))?.[1] ?? null;
const yearOf = (s) => { const m = String(s ?? '').match(/\b(1[5-9]\d\d|20\d\d)\b/); return m ? +m[1] : null; };
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export const openlibrary = {
  name: 'openlibrary',
  base: 'https://openlibrary.org',
  // Discovery: one page of works for a seed. Returns docs with ISBN lists; edition detail comes from `lookup`.
  searchUrl: ({ kind, value, page = 1, limit = 50 }) => {
    const q = kind === 'subject' ? `subject:"${value}"` : kind === 'author' ? `author:"${value}"` : kind === 'series' ? `series:"${value}"` : `title:"${value}"`;
    const fields = 'key,title,author_name,first_publish_year,isbn,language,subject,edition_count';
    return `${openlibrary.base}/search.json?q=${encodeURIComponent(q)}&fields=${fields}&limit=${limit}&page=${page}&sort=editions`;
  },
  parseSearch: (json) => (json.docs ?? []).map((d) => ({
    workKey: d.key, title: clean(d.title), authors: (d.author_name ?? []).map(clean), firstYear: d.first_publish_year ?? null,
    editionCount: d.edition_count ?? 0, subjects: (d.subject ?? []).slice(0, 25), isbns: [...new Set((d.isbn ?? []).map(toIsbn13).filter(Boolean))],
  })),
  lookupUrl: (isbns) => `${openlibrary.base}/api/books?bibkeys=${isbns.map((i) => 'ISBN:' + i).join(',')}&jscmd=details&format=json`,
  parseLookup: (json, fetchedAt) => Object.entries(json ?? {}).flatMap(([k, v]) => {
    const d = v.details ?? {};
    const isbn13 = toIsbn13(k.replace('ISBN:', ''));
    if (!isbn13 || !d.title) return [];
    const lang = (d.languages ?? [])[0]?.key?.split('/').pop();
    return [{
      source: 'openlibrary', sourceId: v.bib_key ?? k, workKey: d.works?.[0]?.key ?? null,
      title: clean(d.title), subtitle: clean(d.subtitle), authors: (d.authors ?? []).map((a) => clean(a.name)),
      publisher: clean((d.publishers ?? [])[0]), year: yearOf(d.publish_date), language: LANG3[lang] ?? null, format: mapFormat(d.physical_format),
      isbn13, subjects: (d.subjects ?? []).slice(0, 25).map((s) => (typeof s === 'string' ? s : s.name)), series: clean((d.series ?? [])[0]) || null,
      url: v.info_url ?? `${openlibrary.base}/isbn/${isbn13}`, fetchedAt,
    }];
  }),
};

export const googlebooks = {
  name: 'googlebooks',
  base: 'https://www.googleapis.com/books/v1',
  isbnUrl: (isbn, key) => `${googlebooks.base}/volumes?q=isbn:${isbn}&maxResults=3&printType=books&fields=items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,language,industryIdentifiers,categories,printType))${key ? '&key=' + key : ''}`,
  parseIsbn: (json, isbn, fetchedAt) => (json.items ?? []).flatMap((it) => {
    const v = it.volumeInfo ?? {};
    const ids = (v.industryIdentifiers ?? []).map((x) => toIsbn13(x.identifier)).filter(Boolean);
    if (!ids.includes(isbn) || !v.title) return []; // the volume must itself carry the ISBN we asked about
    return [{
      source: 'googlebooks', sourceId: it.id, workKey: null, title: clean(v.title), subtitle: clean(v.subtitle), authors: (v.authors ?? []).map(clean),
      publisher: clean(v.publisher), year: yearOf(v.publishedDate), language: v.language ?? null, format: null, isbn13: isbn,
      subjects: (v.categories ?? []).map(clean), series: null, url: `https://books.google.com/books?id=${it.id}`, fetchedAt,
    }];
  }),
};

// goodbooks-10k rows are DISCOVERY ONLY: they nominate titles to look up, and never count towards verification.
export function parseGoodbooksCsv(text, { minRatings = 0 } = {}) {
  const rows = parseCsv(text);
  const head = rows.shift();
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  return rows.map((r) => ({
    source: 'goodbooks10k', title: clean(r[ix.original_title] || r[ix.title]), authors: clean(r[ix.authors]).split(/\s*,\s*/).filter(Boolean).slice(0, 1),
    isbn13: toIsbn13(String(r[ix.isbn13] ?? '').replace(/\.0+$/, '')), year: Math.trunc(+r[ix.original_publication_year]) || null,
    ratingsCount: +r[ix.ratings_count] || 0,
  })).filter((x) => x.title && x.ratingsCount >= minRatings);
}

export function parseCsv(text) {
  const out = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); out.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  return out;
}
