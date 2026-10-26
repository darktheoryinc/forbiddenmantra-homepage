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

const cta = (v, cls = 'btn') => v.url
  ? `<a class="${cls}" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">Visit ${esc(v.brand.name)}<span class="sr"> (opens in a new tab)</span></a>`
  : `<span class="${cls} btn-pending" role="note">${esc(v.brand.name)} link to be added</span>`;

function facts(v, { asset }) {
  const member = v.claim('nvidia-inception-membership'), sep = v.claim('no-endorsement'), tm = v.claim('nvidia-trademark-notice');
  const link = v.external?.nvidiaInception;
  return `<aside class="promo-facts" aria-label="Program membership">
    <p class="pf-h">Program membership</p>
    ${member ? `<p class="pf-main">${esc(member.text)}</p>` : ''}
    ${v.badge ? `<p class="pf-badge" style="--pad:${v.badge.clearSpacePx}px"><img src="${esc(asset(v.badge.asset))}" alt="${esc(v.badge.altText)}" height="${v.badge.displayHeightPx}" style="height:${v.badge.displayHeightPx}px;width:auto"></p>` : ''}
    ${sep ? `<p class="pf-note">${esc(sep.text)}</p>` : ''}
    ${link ? `<p class="pf-link"><a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label)}<span class="sr"> (opens in a new tab)</span></a></p>` : ''}
    ${tm ? `<p class="pf-tm">${esc(tm.text)}</p>` : ''}
  </aside>`;
}

export function renderHome(v, ctx) {
  return `<section class="band promo-band" aria-labelledby="promo-${esc(v.promo.id)}-h" data-promo="${esc(v.promo.id)}" lang="en">
  <div class="wrap">
    <p class="eyebrow">Technology &amp; innovation</p>
    <div class="promo-card">
      <div class="promo-main">
        <p class="promo-kicker">From our technology side</p>
        <h2 id="promo-${esc(v.promo.id)}-h" class="promo-name">${esc(v.brand.name)}</h2>
        <p class="promo-desc">${esc(v.brand.descriptor)}</p>
        <p class="promo-blurb">${esc(v.brand.blurb)}</p>
        <p class="promo-actions">${cta(v)} <a class="btn btn-ghost" href="${ctx.href(v.promo.placements.page.path)}">About this section</a></p>
      </div>
      ${facts(v, ctx)}
    </div>
  </div>
</section>`;
}

export function renderFooter(v, ctx) {
  const name = v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.brand.name)}</a>` : esc(v.brand.name);
  return `<div class="foot-promo" data-promo="${esc(v.promo.id)}" lang="en"><p>${name}, our ${esc(v.brand.descriptor)}. ${esc(v.claim('nvidia-inception-membership').short)} ${esc(v.claim('no-endorsement').short)} <a href="${ctx.href(v.promo.placements.page.path)}">Details</a></p></div>`;
}

export function renderPage(v, ctx) {
  return `<section class="band promo-band" data-promo="${esc(v.promo.id)}" lang="en"><div class="wrap">
    <h1>Technology &amp; innovation</h1>
    <p class="lede-sm">Forbidden Mantra Press is a bookstore and publisher. ${esc(v.brand.name)} is a separate product from the same team.</p>
    <div class="promo-card">
      <div class="promo-main">
        <p class="promo-kicker">Our software platform</p>
        <h2 class="promo-name">${esc(v.brand.name)}</h2>
        <p class="promo-desc">${esc(v.brand.descriptor)}</p>
        <p class="promo-blurb">${esc(v.brand.blurb)}</p>
        <p class="promo-actions">${cta(v)}</p>
      </div>
      ${facts(v, ctx)}
    </div>
    <div class="prose promo-prose">
      <h2>What the membership statement means</h2>
      <p>${esc(v.claim('nvidia-inception-membership').text)} ${esc(v.claim('no-endorsement').text)}</p>
      <p><a href="${esc(v.external.nvidiaInception.url)}" target="_blank" rel="noopener noreferrer">${esc(v.external.nvidiaInception.label)}<span class="sr"> (opens in a new tab)</span></a></p>
      <p class="pf-tm">${esc(v.claim('nvidia-trademark-notice').text)}</p>
    </div>
  </div></section>`;
}
