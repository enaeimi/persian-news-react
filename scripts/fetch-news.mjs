#!/usr/bin/env node
// Fetches the latest headlines from a Persian news source and writes public/news.json.
// Usage: node scripts/fetch-news.mjs <bbc|iranintl>
// Runs in GitHub Actions before each build (browsers cannot fetch these sites directly because of CORS).
import { XMLParser } from 'fast-xml-parser';
import { mkdir, writeFile } from 'node:fs/promises';

const MAX_ITEMS = 50;
const UA = 'Mozilla/5.0 (compatible; persian-news-reader/1.0; +https://github.com)';
const OUT_DIR = new URL('../public/', import.meta.url);

const SOURCES = {
  bbc: {
    id: 'bbc',
    name: 'بی‌بی‌سی فارسی',
    homepage: 'https://www.bbc.com/persian',
    strategies: [() => fromRss('https://feeds.bbci.co.uk/persian/rss.xml', 'rss')],
  },
  iranintl: {
    id: 'iranintl',
    name: 'ایران اینترنشنال',
    homepage: 'https://www.iranintl.com',
    // Iran International does not document a public RSS feed, so several strategies are tried in order.
    strategies: [
      () => fromRss('https://www.iranintl.com/fa/rss', 'rss'),
      () => fromRss('https://www.iranintl.com/rss', 'rss'),
      () => fromHomepage('https://www.iranintl.com/'),
      () => fromGoogleNews('site:iranintl.com', 'ایران اینترنشنال'),
    ],
  },
};

// ---------- helpers ----------
async function get(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.8' },
    signal: AbortSignal.timeout(20_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', zwnj: '‌' };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const clean = (s) => decode(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const text = (v) => (v == null ? '' : typeof v === 'object' ? String(v['#text'] ?? '') : String(v));
function toIso(v) {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}
function absolute(href, base) {
  try { return new URL(href, base).toString(); } catch { return null; }
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: true });

function parseFeed(body) {
  const doc = xml.parse(body);
  const raw = [].concat(doc?.rss?.channel?.item ?? doc?.feed?.entry ?? []);
  if (!raw.length) throw new Error('feed has no items');
  return raw.map((it) => {
    const links = [].concat(it.link ?? []);
    const link = links.map((l) => (typeof l === 'object' ? l['@_href'] ?? text(l) : l)).find(Boolean) ?? text(it.guid);
    return {
      title: clean(text(it.title)),
      link: String(link ?? '').trim(),
      summary: clean(text(it.description ?? it.summary ?? it.content)),
      published: toIso(text(it.pubDate ?? it.published ?? it.updated ?? it['dc:date'])),
      image: [].concat(it['media:thumbnail'] ?? it['media:content'] ?? it.enclosure ?? [])[0]?.['@_url'] ?? null,
      sourceTitle: clean(text(it.source)),
    };
  });
}

// ---------- strategies ----------
async function fromRss(url, method) {
  const items = parseFeed(await get(url));
  return { method: `${method}:${url}`, items: items.map(({ sourceTitle: _s, ...i }) => i) };
}

// Scrapes article links from the homepage. Assumes article URLs end in a long numeric id (e.g. /202411120001).
async function fromHomepage(url) {
  const html = await get(url);
  const seen = new Map();
  const re = /<a\b[^>]*href="([^"#?]*\/\d{9,}[^"#?]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const [, href, inner] of html.matchAll(re)) {
    const link = absolute(href, url);
    const title = clean(inner);
    if (!link || title.length < 15) continue;
    if (!seen.has(link) || seen.get(link).title.length < title.length) {
      seen.set(link, { title, link, summary: '', published: null, image: null });
    }
  }
  if (seen.size < 5) throw new Error(`homepage scrape found only ${seen.size} articles`);
  return { method: `homepage:${url}`, items: [...seen.values()] };
}

// Last resort: Google News RSS restricted to the site. Links go through news.google.com redirects.
async function fromGoogleNews(query, sourceName) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fa&gl=IR&ceid=IR:fa`;
  const items = parseFeed(await get(url)).map(({ sourceTitle: _s, ...i }) => ({
    ...i,
    title: i.title.replace(new RegExp(`\\s+-\\s+${sourceTitle || sourceName}\\s*$`), ''),
    summary: '',
  }));
  return { method: 'google-news', items };
}

// ---------- main ----------
const key = process.argv[2];
const source = SOURCES[key];
if (!source) {
  console.error(`Unknown source "${key}". Use one of: ${Object.keys(SOURCES).join(', ')}`);
  process.exit(2);
}

const errors = [];
let result = null;
for (const strategy of source.strategies) {
  try {
    result = await strategy();
    break;
  } catch (err) {
    errors.push(err.message);
    console.warn(`strategy failed: ${err.message}`);
  }
}
if (!result) {
  console.error(`All strategies failed for ${source.id}:\n - ${errors.join('\n - ')}`);
  process.exit(1); // fail the build so the previously deployed site stays online
}

const items = result.items
  .filter((i) => i.title && i.link)
  .filter((i, idx, arr) => arr.findIndex((j) => j.link === i.link) === idx)
  .sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''))
  .slice(0, MAX_ITEMS);

const { strategies: _strategies, ...meta } = source;
const payload = { source: meta, fetchedAt: new Date().toISOString(), method: result.method, items };
await mkdir(OUT_DIR, { recursive: true });
await writeFile(new URL('news.json', OUT_DIR), JSON.stringify(payload, null, 2));
console.log(`Wrote ${items.length} items from ${source.id} via ${result.method}`);
