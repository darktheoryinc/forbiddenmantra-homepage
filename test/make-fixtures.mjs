// Generates FICTIONAL multilingual fixture records for tests. Output: test/fixtures/. Never used for the real catalogue.
import fs from 'node:fs';
const D = '2026-10-26';
const isbn = (n) => { const b = '978000000' + String(n).padStart(3, '0'); let s = 0; for (let i = 0; i < 12; i++) s += +b[i] * (i % 2 ? 3 : 1); return b + ((10 - (s % 10)) % 10); };
const src = (l) => [{ label: `FIXTURE source for ${l}`, url: `https://example.invalid/fixture/${l}`, accessed: D, supports: 'fictional test edition' }];
const rt = (market, id) => ({ retailer: 'amazon', marketplace: market, url: `https://www.${market}/dp/${id}`, verification: 'seen-in-search-results', checkedOn: D });
const work = (o) => ({ authors: ['Fixture Author One'], level: 'beginner', press: null, status: 'verified', claims: [], sources: src('work'), tradition: ['secular'], ...o });
const works = [
  work({ title: 'Fixture Atlas of Breath', subtitle: 'A Fictional Test Book', subjects: ['mindfulness', 'yoga'], description: 'Fictional record used to test multilingual edition grouping. It does not exist.',
    editions: [
      { format: 'paperback', language: 'en', publisher: 'Fixture House', year: 2020, isbn13: isbn(1) },
      { format: 'ebook', language: 'en', publisher: 'Fixture House', year: 2020, isbn13: isbn(2) },
      { format: 'paperback', language: 'es', title: 'Atlas Ficticio del Aliento', subtitle: 'Un libro de prueba', translator: 'Fixture Translator', publisher: 'Casa Ficticia', year: 2021, isbn13: isbn(3), sources: src('es-paperback'), retailers: [rt('amazon.es', 'FIXTURES01')] },
      { format: 'ebook', language: 'es', title: 'Atlas Ficticio del Aliento', publisher: 'Casa Ficticia', year: 2021, isbn13: isbn(4), sources: src('es-ebook'), retailers: [rt('amazon.com.mx', 'FIXTURES02')] },
      { format: 'hardcover', language: 'de', title: 'Fiktiver Atem-Atlas', publisher: 'Fiktiver Verlag', year: 2022, isbn13: isbn(5), sources: src('de-hardcover'), retailers: [rt('amazon.de', 'FIXTUREDE1')] },
      { format: 'paperback', language: 'ar', title: 'أطلس النفس الوهمي', publisher: 'دار وهمية', year: 2023, isbn13: isbn(6), sources: src('ar-paperback'), retailers: [rt('amazon.ae', 'FIXTUREAR1')] },
      { format: 'audiobook', language: 'fr', title: 'Atlas fictif du souffle', publisher: 'Maison Fictive', year: 2024, isbn13: isbn(7), sources: src('fr-audiobook'), retailers: [rt('amazon.fr', 'FIXTUREFR1')] }] }),
  work({ title: 'Fixture Companion Guide', subjects: ['yoga'], description: 'Fictional record: English e-book plus a Spanish paperback only, to prove that language and format are matched on the same edition.',
    editions: [
      { format: 'ebook', language: 'en', publisher: 'Fixture House', year: 2019, isbn13: isbn(8) },
      { format: 'paperback', language: 'es', title: 'Guía Compañera Ficticia', publisher: 'Casa Ficticia', year: 2020, isbn13: isbn(9), sources: src('es-companion'), retailers: [rt('amazon.com', 'FIXTURES09')] }] }),
  work({ title: 'Fixture Sanskrit Reader', subjects: ['sanskrit-mantras', 'ancient-texts'], tradition: ['hindu'], authors: ['Fixture Author Two'], description: 'Fictional bilingual Sanskrit–English edition to test alsoLanguages counting.',
    editions: [{ format: 'paperback', language: 'en', alsoLanguages: ['sa'], publisher: 'Fixture House', year: 2018, isbn13: isbn(10), sources: src('bilingual') }] }),
  work({ title: 'Fixture Unsourced Translation', subjects: ['yoga'], description: 'Must be REJECTED: contains a Spanish edition without its own source.',
    editions: [{ format: 'paperback', language: 'en', isbn13: isbn(11) }, { format: 'paperback', language: 'es', title: 'Traducción sin fuente', isbn13: isbn(12) }] }),
  work({ title: 'Fixture Bad Language', subjects: ['yoga'], description: 'Must be REJECTED: unknown language code.', editions: [{ format: 'paperback', language: 'xx', isbn13: isbn(13), sources: src('xx') }] }),
];
fs.writeFileSync('test/fixtures/staging/verified/fixtures.json', JSON.stringify({ works }, null, 1));
fs.writeFileSync('test/fixtures/staging/candidates.psv', ['title|subtitle|authors|publisher|year|isbn13|format|language|subjects|tradition|level|translationOf|editionTitle|translator',
  `Fixture Staged German||Fixture Author One|Fiktiver Verlag|2022|${isbn(20)}|paperback|de|yoga|secular|beginner|fixture-companion-guide|Fiktiver Begleiter|Fixture Translator`,
  `Fixture Staged Bad Parent||Fixture Author One|X|2022|${isbn(21)}|paperback|de|yoga|secular|beginner|no-such-work||`,
  `Fixture Staged Same Language||Fixture Author One|X|2022|${isbn(22)}|paperback|es|yoga|secular|beginner|fixture-companion-guide||`,
  `Fixture Plain Candidate||Fixture Author One|Fixture House|2020|${isbn(23)}|paperback|en|yoga|secular|beginner|||`].join('\n'));
fs.writeFileSync('test/fixtures/staging/edition-leads.json', JSON.stringify({ leads: [{ workId: 'fixture-atlas-of-breath', language: 'it', format: 'ebook', note: 'fictional lead', source: { label: 'fixture', url: 'https://example.invalid/lead', accessed: D } }] }));
fs.writeFileSync('test/fixtures/data/collections.json', JSON.stringify({ paths: [{ id: 'fixture-path', title: 'Fixture Path', audience: 'Tests', blurb: 'Fictional.', steps: [{ work: 'fixture-atlas-of-breath', why: 'Fictional.' }] }], collections: [{ id: 'fixture-collection', title: 'Fixture Collection', blurb: 'Fictional.', works: ['fixture-atlas-of-breath', 'fixture-companion-guide', 'fixture-sanskrit-reader'] }] }));
console.log('fixtures written');
