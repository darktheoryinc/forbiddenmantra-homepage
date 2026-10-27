// Cross-promotion engine. Zero dependencies and no bookstore imports, so it can be copied into another site.
//   validate(registry, { root, production }) -> { errors, blockers, warnings }
//   resolve(registry, promoId, placement, { root })  -> view model (claims, badge, tagged URL)
//   renderHome / renderFooter / renderPage(view, { esc, href, asset }) -> HTML strings
// The registry format is documented in docs/CROSS-PROMOTION.md.
import fs from 'node:fs';
import path from 'node:path';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const loadRegistry = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export function tagUrl(url, site, promo, placement) {
  if (!url) return null;
  const u = new URL(url);
  u.searchParams.set('utm_source', site.utmSource);
  u.searchParams.set('utm_medium', site.utmMedium);
  u.searchParams.set('utm_campaign', promo.utmCampaign);
  u.searchParams.set('utm_content', placement);
  return u.toString();
}

// Badge gate: returns { ok, reasons[] }. A badge renders only if every condition holds.
export function badgeState(badge, root) {
  const reasons = [];
  if (!badge?.enabled) return { ok: false, enabled: false, reasons: ['badge disabled'] };
  if (!badge.asset) reasons.push('no asset path');
  else if (!fs.existsSync(path.join(root, 'assets-src/partner', badge.asset))) reasons.push(`asset file not found: assets-src/partner/${badge.asset}`);
  if (badge.licenseConfirmed !== true) reasons.push('licenseConfirmed is not true');
  if (!badge.guidelinesUrl) reasons.push('guidelinesUrl missing');
  if (!badge.guidelinesReviewedOn) reasons.push('guidelinesReviewedOn missing');
  if (!badge.altText) reasons.push('altText missing');
  return { ok: reasons.length === 0, enabled: true, reasons };
}

export function validate(reg, { root, production = false } = {}) {
  const errors = [], blockers = [], warnings = [];
  const claimById = new Map(reg.claims.map((c) => [c.id, c]));
  for (const p of reg.promos) {
    const b = reg.brands[p.brand];
    if (!b) { errors.push(`promo ${p.id}: unknown brand "${p.brand}"`); continue; }
    if (!reg.promos.length) break;
    if (b.url && !/^https:\/\//.test(b.url)) errors.push(`brand ${p.brand}: url must be https`);
    for (const id of p.claims ?? []) {
      const c = claimById.get(id);
      if (!c) { errors.push(`promo ${p.id}: unknown claim "${id}"`); continue; }
      if (c.brand !== p.brand) errors.push(`claim ${id} belongs to ${c.brand}, not ${p.brand}`);
      if (c.status !== 'verified') (production ? blockers : warnings).push(`claim "${id}" is ${c.status}; verify before launch${c.beforeLaunch ? ': ' + c.beforeLaunch.join(' ') : ''}`);
    }
    // an NVIDIA membership claim must always travel with the separation statement
    if ((p.claims ?? []).includes('nvidia-inception-membership') && !(p.claims ?? []).includes('no-endorsement')) errors.push(`promo ${p.id}: the membership claim must be accompanied by the "no-endorsement" claim`);
    for (const [name, badge] of Object.entries(b.badges ?? {})) {
      const s = badgeState(badge, root);
      if (s.enabled && !s.ok) errors.push(`brand ${p.brand} badge "${name}" is enabled but cannot be used: ${s.reasons.join('; ')}`);
    }
    // wording lint: prohibited variants (declared on claims) may not appear in any copy for this brand
    const banned = reg.claims.flatMap((c) => c.prohibitedVariants ?? []);
    const copy = [b.name, b.descriptor, b.blurb, b.relationship, ...(p.claims ?? []).flatMap((id) => [claimById.get(id)?.text, claimById.get(id)?.short])].filter(Boolean);
    for (const t of copy) for (const phrase of banned) if (t.toLowerCase().includes(phrase.toLowerCase())) errors.push(`promo ${p.id}: copy contains prohibited wording "${phrase}": "${t.slice(0, 80)}"`);
    if (!b.url) (production ? blockers : warnings).push(`brand ${p.brand}: no url set (preview shows a placeholder)`);
    if (!p.approved) (production ? blockers : warnings).push(`promo ${p.id}: not approved by the owner`);
  }
  return { errors, blockers, warnings };
}

export function resolve(reg, promoId, placement, { root } = {}) {
  const promo = reg.promos.find((p) => p.id === promoId);
  const brand = reg.brands[promo.brand];
  const claims = (promo.claims ?? []).map((id) => reg.claims.find((c) => c.id === id));
  const badge = badgeState(brand.badges?.nvidiaInception, root);
  return {
    promo, brand, claims, placement, site: reg.site,
    url: tagUrl(brand.url, reg.site, promo, placement),
    badge: badge.ok ? brand.badges.nvidiaInception : null,
    claim: (id) => claims.find((c) => c.id === id),
    external: reg.externalLinks,
  };
}

// brand art (hero image / logo) is used only when the file exists and the owner has confirmed the rights
export function assetState(a, root) {
  if (!a?.enabled) return { ok: false, enabled: false };
  if (!a.asset || !fs.existsSync(path.join(root, 'assets-src/partner', a.asset)) || a.rightsConfirmed !== true) return { ok: false, enabled: true };
  return { ok: true, enabled: true };
}
const cta = (v, cls = 'btn') => v.url
  ? `<a class="${cls}" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" data-track="promo" data-promo="${esc(v.promo.id)}" data-placement="${esc(v.placement)}">Visit IOSutra<span class="sr"> (opens iosutra.com in a new tab)</span></a>`
  : `<span class="${cls} btn-pending" role="note">${esc(v.brand.name)} link to be added</span>`;
const lnk = (v, placement, inner, cls, label) => v.url
  ? `<a class="${cls}" href="${esc(tagUrl(v.brand.url, v.site, v.promo, placement))}" target="_blank" rel="noopener noreferrer" data-track="promo" data-promo="${esc(v.promo.id)}" data-placement="${esc(placement)}"${label ? ` aria-label="${esc(label)}"` : ''}>${inner}</a>`
  : `<div class="${cls}">${inner}</div>`;

// IOSutra identity: dark-green panel with gold type, used by the home section and the technology page
function card(v, { asset, root, big }) {
  const hero = v.brand.hero, hs = assetState(hero, root), badge = v.badge, member = v.claim('nvidia-inception-membership'), sep = v.claim('no-endorsement'), tm = v.claim('nvidia-trademark-notice');
  const link = v.external?.nvidiaInception;
  const wordmark = '<span class="io-wordmark" aria-hidden="true"><span class="io-mark"></span>IOSutra</span>';
  const media = hs.ok
    ? `<img src="${esc(asset(hero.asset))}" width="${hero.width}" height="${hero.height}" alt="${esc(hero.altText)}" loading="lazy" decoding="async">`
    : `<span class="io-art" aria-hidden="true"></span>${wordmark.replace('aria-hidden="true"', '')}`;
  return `<div class="promo-card io-card${big ? ' io-big' : ''}">
    ${lnk(v, v.placement + '-image', media, 'io-media', 'IOSutra: ' + v.brand.headline + ' (opens iosutra.com in a new tab)')}
    <div class="io-panel">
      <h2 id="promo-${esc(v.promo.id)}-h" class="promo-name io-title">${esc(v.brand.headline)}</h2>
      <p class="io-sub">${esc(v.brand.subline)}</p>
      <div class="io-tiles" role="group" aria-label="Program membership">
        ${lnk(v, v.placement + '-logo', `<span class="io-wordmark io-wm-dark">IOSutra</span><span class="io-tile-t">Inception<br>Member</span>`, 'io-tile', 'IOSutra, Inception Member (opens iosutra.com in a new tab)')}
        <div class="io-tile io-tile-nv">${badge ? `<img src="${esc(asset(badge.asset))}" alt="${esc(badge.altText)}" height="${badge.displayHeightPx}" style="height:${badge.displayHeightPx}px;width:auto">` : '<span class="io-nv-text">NVIDIA</span><span class="io-tile-t">Inception<br>Program</span>'}</div>
      </div>
      ${member ? `<p class="io-member">${esc(member.text)}</p>` : ''}
      <p class="io-actions">${cta(v, 'btn io-cta')}</p>
      <p class="io-legal">${sep ? esc(sep.text) + ' ' : ''}${tm ? esc(tm.text) : ''}${link ? ` <a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)}<span class="sr"> (opens in a new tab)</span></a>` : ''}</p>
    </div>
  </div>`;
}
const ctxRoot = (ctx) => ctx.root ?? process.cwd();

export function renderHome(v, ctx) {
  return `<section class="band promo-band" aria-labelledby="promo-${esc(v.promo.id)}-h" data-promo="${esc(v.promo.id)}" lang="en">
  <div class="wrap">
    <p class="eyebrow">Technology &amp; innovation · from our team</p>
    ${card(v, { asset: ctx.asset, root: ctxRoot(ctx) })}
    <p class="io-more"><a href="${ctx.href(v.promo.placements.page.path)}">About this section →</a></p>
  </div>
</section>`;
}

export function renderFooter(v, ctx) {
  const name = v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" data-track="promo" data-promo="${esc(v.promo.id)}" data-placement="${esc(v.placement)}">${esc(v.brand.name)}</a>` : esc(v.brand.name);
  return `<div class="foot-promo" data-promo="${esc(v.promo.id)}" lang="en"><p>${name}, our ${esc(v.brand.descriptor)}. ${esc(v.claim('nvidia-inception-membership').short)} ${esc(v.claim('no-endorsement').short)} <a href="${ctx.href(v.promo.placements.page.path)}">Details</a></p></div>`;
}

export function renderPage(v, ctx) {
  return `<section class="band promo-band" data-promo="${esc(v.promo.id)}" lang="en"><div class="wrap">
    <h1>IOSutra: technology &amp; innovation</h1>
    <p class="lede-sm">Forbidden Mantra Press is a bookstore and publisher. ${esc(v.brand.name)} is a separate product from the same team.</p>
    ${card(v, { asset: ctx.asset, root: ctxRoot(ctx), big: true })}
    <div class="prose promo-prose">
      <h2>About IOSutra</h2>
      <p>${esc(v.brand.descriptor)}. ${esc(v.brand.relationship)}</p>
      <h2>What the membership statement means</h2>
      <p>${esc(v.claim('nvidia-inception-membership').text)} ${esc(v.claim('no-endorsement').text)}</p>
      <p><a href="${esc(v.external.nvidiaInception.url)}" target="_blank" rel="noopener noreferrer">${esc(v.external.nvidiaInception.label)}<span class="sr"> (opens in a new tab)</span></a></p>
      <p class="pf-tm">${esc(v.claim('nvidia-trademark-notice').text)}</p>
    </div>
  </div></section>`;
}
