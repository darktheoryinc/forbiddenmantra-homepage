# Security audit: the Wix hosting package (2026-10-27)

Scope: the 521-file package `wix/forbiddenmantra-site-for-hosting.zip` / `wix/hosting/` (commit 8445e7d) that was dropped on Netlify Drop, plus the repository.
Method: static scan of every file (HTML, JS, JSON, CSS, SVG, WebP metadata, `_headers`) with credential, personal-data, internal-reference and host patterns, plus manual review of what the pages say. Values of any secret would never be printed; **none was found**.

## Verdict
**Package contents: no secrets or private data found.** The package could be downloaded by anyone who had its address, and what they would have seen is the public bookstore. **Cannot fully verify the live Netlify deployment** (see below). **Not safe to leave public as-is** for business reasons that are not secrets: unapproved NVIDIA branding and a membership claim, and a public statement about unpublished titles (both fixed in the rebuilt package).

## Findings
| # | Severity | Category | Where | Detail | Status |
|---|---|---|---|---|---|
| 1 | **HIGH** | Unapproved third-party trademark / affiliation claim | 509 pages (home, footer, technology page), `assets/partner/nvidia-inception-program-badge-rgb-for-screen.svg`, `assets/partner/iosutra-inception-member.webp`, promo text | The official NVIDIA badge, the "Inception Member" panel and the statement "IOSutra is a member of the NVIDIA Inception program" were public while NVIDIA wording, the Inception guidelines/attribution and the membership check were still unconfirmed (`data/promos.json`: claim "owner-asserted", trademark notice "needs-confirmation", promo not approved). | **Fixed in the new package** (withheld until `config/approvals.json` records approval). The old upload still shows it: see "Immediate actions". |
| 2 | MEDIUM | Unverified business claim / internal workflow note | `press/index.html` | Said "Amazon lists the Forbidden Mantra Series as 41 books" (an unconfirmed web-search lead) and that remaining titles "are waiting on an export of the Amazon KDP/Author Central catalogue". | **Fixed** (neutral wording in all builds). |
| 3 | MEDIUM | Image rights / likeness | `assets/partner/iosutra-wellness-ai.webp` (a real-looking person and a robot), `assets/librarian/librarian.webp` | Commercial-use and likeness permissions were never confirmed. | **Open.** Recorded as unapproved; blocks production, allowed in a preview. |
| 4 | LOW | Draft/preview material public | all pages (preview bar, HTML comment), legal pages ("Draft for owner and legal review") | Legal pages are drafts based on recovered summaries; the notices say so. | By design for a preview; production is blocked until reviewed. |
| 5 | LOW | Privacy | every page | Fonts load from Google Fonts, so visitors' IP addresses reach Google. | Open (self-hosting fonts would remove it). |
| 6 | LOW | Missing security headers | host config | No CSP / nosniff / referrer / permissions headers. | **Fixed:** `_headers` now sets them (CSP without `frame-ancestors`, so the Wix embed cannot be blocked). Tested: all browser tests pass under the policy with no violations. |
| 7 | LOW | Search indexing | host config | A preview could be indexed. | `_headers` adds `X-Robots-Tag: noindex` and `robots.txt` disallows all for previews. Header support on Netlify Drop is not verified. |
| 8 | INFO | Repository hygiene (not in the package) | git | 14,395 + 830 generated test-build files (465 MB perf build with synthetic records, fixture builds) had been committed by mistake. They contain no secrets, but bloat the repo and mix fictional data into it. | **Fixed going forward** (untracked and git-ignored). History still holds them (336 MB `.git`); rewriting history was not done without your approval. |
| 9 | INFO | Normal public material | - | Amazon Associates ID `darktheoryinc-20` (public by design; the only `tag=` value present, 242 occurrences); citations to retailer and publisher URLs; links to iosutra.com, spiritualexpressionz.com, dogsrfun.com; client JavaScript (app.js, librarian.js, search index) which is public by nature. | No action. |

## Checked and clean
No credential-shaped strings (AWS, Google, Stripe, GitHub, Slack, NVIDIA, Amazon API, JWT, private keys); no email addresses; no phone numbers or customer records; no local file paths; no `claude.ai`/session references; no repository URL; no hidden files, source maps, `.env`, markdown, zip or script files; no external scripts, iframes, forms posting out, `eval`/`new Function`/`document.write`; WebP images carry no EXIF/XMP/author metadata; the SVG has no metadata or comments. Git history authors are the owner's GitHub noreply address and the assistant.
No Amazon Creators API, AWS, Google Cloud, Stripe, GitHub, Wix, IOSutra or NVIDIA credentials exist anywhere in the repository or package, so **nothing needs rotating**.

## Netlify exposure: verified facts and unknowns
* **Verified:** this environment cannot reach netlify.app or any external host, and no deployment URL or screenshot was included in the request, so **I have not accessed the deployment**. I cannot confirm what it serves, whether `_headers` took effect, or whether it is still online.
* **Reasonable expectations (not verified):** a Netlify Drop site is reachable by anyone who has its address; being unclaimed or temporary does not make it private. Everything in the package is downloadable, which is why the audit above matters. Search engines can only find it if the address is shared or linked.
* **Not possible for me:** deleting or changing the Netlify site (no access, and I was not authorised to delete it).

## Immediate actions required from you
1. **Take the existing Netlify deployment offline** (Netlify dashboard > the site > Site configuration > Delete site; if it was never claimed, it can only be removed by the account that created it or by letting it expire, so treat it as public until it is gone). Reason: it shows the NVIDIA badge and claim without approval. It contains no credentials.
2. Do not share its address further. If it was shared or posted anywhere, remove those links.
3. If you want a new preview, upload the rebuilt package (`wix/forbiddenmantra-site-for-hosting.zip`, sha256 in the install guide), which withholds the NVIDIA material.
4. Nothing to rotate or revoke: no credentials were exposed.
5. To inspect the NVIDIA badge privately, use the private claude.ai preview, not a public host.

## What was built to prevent a repeat
* `scripts/security-gate.mjs`: scans a package and rejects secrets, private data, non-public file types, hidden files, external scripts/iframes, unknown affiliate tags, NVIDIA branding without a recorded approval, and (with `--production`) any missing approval or remaining preview marker.
* `config/approvals.json`: every approval is **false**; nothing was granted by me. Public packages (`FM_PUBLIC=1`) withhold approval-gated material automatically.
* `scripts/make-wix-package.mjs` runs the gate before writing anything: a failing package is not zipped or copied into `wix/`.
* `scripts/verify-wix-package.mjs` re-runs the gate on the extracted archive and runs the browser tests under the package's security headers (53 checks).
* `test/verify-security-gate.mjs`: 28 checks that seeded bad packages (fake keys, emails, local paths, `.env`, source maps, markdown, hidden files, unknown tags, external scripts, NVIDIA without approval, production without approvals) are rejected.

## Remaining risks and launch blockers
Cover images (none yet), unverified purchase links (116 search-only), the six approvals in `config/approvals.json`, the iframe limits, image likeness and licence, and fonts served by Google. The old upload remains public until you remove it.
