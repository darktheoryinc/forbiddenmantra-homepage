export interface NewsItem { title: string; url: string; source?: string; publishedAt?: string }

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()

const tag = (block: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  return m ? decode(m[1]) : undefined
}

/** Parses RSS 2.0 <item> blocks. Only returns items that have a title and an http(s) link. */
export function parseRss(xml: string, limit = 20): NewsItem[] {
  const items: NewsItem[] = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[1]
    const title = tag(block, 'title')
    const url = tag(block, 'link')
    if (!title || !url || !/^https?:\/\//i.test(url)) continue
    const pub = tag(block, 'pubDate')
    const parsed = pub ? new Date(pub) : undefined
    const source = tag(block, 'source')
    items.push({
      title: source && title.endsWith(` - ${source}`) ? title.slice(0, -(source.length + 3)) : title,
      url,
      source,
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : undefined,
    })
  }
  return items
}
