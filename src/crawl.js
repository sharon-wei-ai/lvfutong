import { crawlSources, KEYWORDS } from "./sources.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const HTML_LIMIT = 280000;
const FETCH_MS = 10000;

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return "";
  }
}

function hitKeyword(text) {
  return KEYWORDS.some((k) => text.includes(k));
}

function itemId(url) {
  let h = 0;
  for (const ch of url) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return "live-" + h.toString(16);
}

function guessDate(text, url = "") {
  const stamped = url.match(/t(20\d{2})(\d{2})(\d{2})_/);
  if (stamped) return `${stamped[1]}-${stamped[2]}-${stamped[3]}`;
  const m =
    text.match(/20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}/) ||
    text.match(/20\d{2}[-/.年]\d{1,2}/);
  if (!m) return "";
  return m[0]
    .replace(/[年.]/g, "-")
    .replace(/[月]/g, "-")
    .replace(/日/g, "")
    .replace(/\//g, "-");
}

function sameSite(href, base) {
  try {
    const a = new URL(href);
    const b = new URL(base);
    return a.hostname === b.hostname || a.hostname.endsWith(`.${b.hostname}`);
  } catch {
    return false;
  }
}

function isNotice(title) {
  return /通知|办法|申报|印发|公告|指南|意见|方案/.test(title);
}

function isRecent(title, url) {
  if (/202[5-9]|203\d/.test(title) || /\/202[5-9]|\/203\d/.test(url)) return true;
  if (/\/201\d|\/202[0-4]/.test(url) || /202[0-4]年/.test(title)) return false;
  return true;
}

function isNoise(title) {
  return /草品种|林木品种审定|招聘|招标代理|网站地图/.test(title);
}

function extractItems(html, source) {
  const items = [];
  const re = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = absUrl(m[1], source.url);
    const title = stripTags(m[2]);
    if (!href || title.length < 12 || title.length > 90) continue;
    if (!sameSite(href, source.url)) continue;
    if (href.replace(/\/$/, "") === source.url.replace(/\/$/, "")) continue;
    if (!hitKeyword(title) || !isNotice(title) || !isRecent(title, href) || isNoise(title)) continue;
    items.push({
      id: itemId(href),
      title,
      url: href,
      source: source.name,
      sourceId: source.id,
      region: source.region,
      topics: source.topics,
      date: guessDate(title, href) || "",
      kind: "新发",
    });
  }
  const seen = new Set();
  return items.filter((it) => {
    if (seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });
}

async function fetchSource(source) {
  const started = Date.now();
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,*/*",
        Referer: source.url,
      },
      signal: AbortSignal.timeout(FETCH_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      return {
        sourceId: source.id,
        status: "fail",
        error: `HTTP ${res.status}`,
        ms: Date.now() - started,
        items: [],
      };
    }
    const html = (await res.text()).slice(0, HTML_LIMIT);
    const items = extractItems(html, source).slice(0, 12);
    return {
      sourceId: source.id,
      status: items.length ? "ok" : "empty",
      ms: Date.now() - started,
      items,
    };
  } catch (err) {
    return {
      sourceId: source.id,
      status: "fail",
      error: String(err.message || err),
      ms: Date.now() - started,
      items: [],
    };
  }
}

export async function buildFeed() {
  const active = crawlSources.filter((s) => s.active);
  const results = await Promise.all(active.map(fetchSource));
  const items = [];
  const seen = new Set();
  for (const r of results) {
    for (const it of r.items) {
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      items.push(it);
    }
  }
  return {
    fetchedAt: new Date().toISOString(),
    itemCount: items.length,
    sources: results.map(({ items: _i, ...rest }) => rest),
    items,
  };
}
