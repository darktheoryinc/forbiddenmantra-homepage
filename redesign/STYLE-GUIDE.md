# Forbidden Mantra Press: emerald, cream and gold styling guide

For the Wix Studio pages that are not the homepage embed (blog, legal pages, members, forms, contact, every other page). **This changes appearance only.** Do not edit, reorder or delete any text, book, link, image, SEO field or page. Apply it first to the duplicate site `FMBACKUP 2026-11-04`, never to the live site until the redesign is approved.

## 1. Colours (from the compliant Library, commit `be88058`)
| Role | Name | Hex | Use |
|---|---|---|---|
| Header, nav, hero, footer | Emerald | `#183F3B` | main dark surface |
| Deepest surface | Deep emerald | `#0F2C29` | search band, footer, bars |
| Announcement strip | Darkest emerald | `#0B2220` | top strip |
| Page background | Cream | `#F7F1E4` | all light sections |
| Cards / form fields | Soft white | `#FFFDF8` | cards, inputs |
| Alternate band | Sage | `#D9E9DF` | every second content band |
| Accent | Gold | `#D8B46B` | buttons, borders, rules |
| Accent on dark | Light gold | `#EFD79C` | headings and links on emerald |
| Accent on cream | Dark gold | `#7A5B12` | small labels on cream |
| Body text on cream | Ink | `#22403C` | paragraphs |
| Secondary text | Muted ink | `#4A6761` | captions, meta lines |
| Text on emerald | Warm cream | `#F1E9D6` / `#CFE2DC` | body / small print |
| Focus ring | Pale gold | `#FFF3C4` | keyboard focus, 3 px |

Contrast (WCAG AA needs 4.5:1 for normal text):
| Pair | Ratio |
|---|---|
| Light gold on emerald | 8.2:1 |
| Warm cream on deep emerald | 12.3:1 |
| Gold on deep emerald | 7.5:1 |
| Ink on cream | 10.0:1 |
| Emerald heading on cream | 10.3:1 |
| Dark gold on cream | 5.6:1 |
| Muted ink on soft white | 6.1:1 |
| Dark text on gold button | 9.8:1 |

In Wix Studio: Site Design, Colors. Set the site palette to these hex values so new elements inherit them.

## 2. Typography (the three families the original page already loads)
* **Cinzel Decorative**: page titles and card titles. Light gold on emerald, emerald on cream. Large, never below 28 px.
* **Cinzel** (uppercase, letter-spacing 0.12 to 0.18 em): navigation, buttons, small labels, section eyebrows. 10 to 13 px.
* **EB Garamond**: all body text, 17 to 20 px, line height 1.6 to 1.7.
* In Studio: Site Design, Fonts. Check that all three are in Wix's font list; if one is missing, use Cormorant Garamond for body and keep Cinzel for headings. (Not verified from here.)

## 3. Components
* **Announcement strip:** darkest emerald, light-gold Cinzel 10 px, gold hairline underneath.
* **Header / navigation:** emerald `#183F3B`, 1 px light-gold border at 28 % opacity, soft shadow. Logo in light gold; links warm cream, hover light gold; the key call to action is a gold button with near-black text, 2 px radius.
* **Search band (new):** deep emerald band; a soft-white card with a 1 px gold border; Atma's face (64 px circle, 2 px gold ring) at the left; label "Search Our Book Library" in emerald Cinzel; white input; gold Search button.
* **Partner tiles:** IOSutra logo and NVIDIA badge each on a white tile with a light-gold border; both 52 px high on desktop (44 px on phones). Never recolour, crop or stretch either asset.
* **Hero:** emerald gradient (top `#183F3B`, bottom `#0F2C29`) with a faint gold glow; title light gold, subtitle gold, text warm cream; primary button gold, secondary outlined light gold.
* **Content sections:** cream background; eyebrow in dark gold, title in emerald.
* **Book cards:** soft-white card, 1 px emerald border at 20 % opacity, 4 px radius, light shadow; hover lifts 2 px. Cover (or title card) has a 1 px gold border; title card is an emerald gradient with the title in light gold. Title in emerald, meta line in muted ink.
* **Buttons:** gold fill, near-black Cinzel text, 2 px radius, 44 px minimum height; hover light gold. Secondary: transparent, 1 px light-gold border on emerald, or emerald border on cream.
* **Footer:** deep emerald with a 3 px gold top rule; brand in light gold; links warm cream; legal and NVIDIA notices in `#CFE2DC` at 14 px.
* **Forms (contact, newsletter, members):** soft-white fields, 1 px emerald border at 45 %, gold submit button, error text in `#8A2B2B` on cream.
* **Blog:** cream page, emerald headings, ink text, gold dividers; keep every post's content and SEO exactly as is.
* **Focus:** every link, button and field shows a 3 px pale-gold ring.

## 4. Spacing and layout
Content width 1200 px; section padding 70 to 90 px desktop, 56 px tablet, 40 to 60 px phone; card gap 28 px (24 px phone); four columns desktop, two tablet, one phone.

## 5. Rules that must not be broken
* No book, price, description, link, affiliate address, cover or SEO field may change.
* Amazon links stay exactly as they are. No Amazon images (hotlinked or constructed) anywhere.
* NVIDIA: official badge only, unmodified, never implying endorsement; keep the approved notice (membership applies to IOSutra only; not an endorsement; NVIDIA trademarks acknowledged).
* IOSutra Pay As You Go: label only, with no price or checkout, until its verified address is supplied.
* Keep the "As an Amazon Associate" statement visible on every page that has Amazon links.
