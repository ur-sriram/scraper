/* ------------------------------------------------------------------ */
/*  SIEVE — real extraction engine (no synthetic data, ever)           */
/*                                                                     */
/*  Sources:                                                           */
/*   · LinkedIn  → public profile via Jina Reader (rendered page) +    */
/*     raw HTML via CORS relays; every field cites its origin.         */
/*     Auth-walled fields are labeled AUTH — never invented.           */
/*   · GitHub    → api.github.com REST v3 (CORS-native, unauthenticated)*/
/*   · LeetCode  → public stats API / GraphQL, triple fallback         */
/* ------------------------------------------------------------------ */

export type FieldStatus = "found" | "derived" | "missing" | "auth" | "error";

export type Field = {
  label: string;
  kind: "text" | "link" | "chips" | "lines" | "bars";
  value?: string;
  values?: string[];
  bars?: { label: string; pct: number; detail: string }[];
  status: FieldStatus;
  conf: number;
  source: string;
  note?: string;
};

export interface ModuleData {
  id: string;
  name: string;
  icon: string;
  summary: string;
  fields: Field[];
  entries?: { title: string; subtitle?: string; meta?: string; fields: Field[] }[];
}

export interface Trace {
  via: string;
  url: string;
  status: number | "ERR";
  bytes: number;
  ms: number;
  ok: boolean;
}

export interface SourceResult {
  id: "linkedin" | "github" | "leetcode";
  label: string;
  status: "ok" | "partial" | "failed" | "off";
  handle: string;
  url?: string;
  avatar?: string;
  modules: ModuleData[];
  traces: Trace[];
  stats: { found: number; derived: number; missing: number; auth: number; error: number };
  error?: string;
}

export interface Extraction {
  targets: { linkedin: string | null; github: string | null; leetcode: string | null };
  results: SourceResult[];
  ms: number;
  at: string;
  engine: string;
}

export type LogTone = "info" | "ok" | "warn" | "dim" | "err";
export type LogSink = (text: string, tone?: LogTone) => void;

export type SourceId = "linkedin" | "github" | "leetcode";
export type SourceUi = "queued" | "running" | "done" | "failed" | "off";
export type SourceProgress = (id: SourceId, state: SourceUi, modules: ModuleData[]) => void;

const ENGINE = "sieve/live-fetch v2.1 · jina-reader + github REST + leetcode GraphQL";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/*  handle parsing                                                     */
/* ------------------------------------------------------------------ */

export function parseSlug(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = raw.match(/linkedin\.com\/in\/([A-Za-z0-9\-_%]+)\/?/i);
  if (m) return m[1].toLowerCase();
  if (/^[A-Za-z0-9\-_%]{3,100}$/.test(raw)) return raw.toLowerCase();
  return null;
}

export function normalizeGithub(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = raw.match(/github\.com\/([A-Za-z0-9-]+)\/?/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(raw)) return raw;
  return null;
}

export function parseLeetcode(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = raw.match(/leetcode\.com\/(?:u\/)?([A-Za-z0-9\-_]+)/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9\-_]{2,50}$/.test(raw)) return raw;
  return null;
}

/* ------------------------------------------------------------------ */
/*  fetch plumbing                                                     */
/* ------------------------------------------------------------------ */

function childSignal(parent?: AbortSignal): AbortSignal {
  const c = new AbortController();
  if (parent) {
    if (parent.aborted) c.abort();
    else parent.addEventListener("abort", () => c.abort(), { once: true });
  }
  return c.signal;
}

async function fetchWithTimeout(
  url: string,
  parent: AbortSignal | undefined,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  if (parent) {
    if (parent.aborted) {
      clearTimeout(t);
      throw new DOMException("aborted", "AbortError");
    }
    parent.addEventListener("abort", () => c.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

const RELAYS: { via: string; build: (u: string) => string }[] = [
  { via: "allorigins", build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { via: "corsproxy.io", build: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}` },
  { via: "codetabs", build: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
];

interface FetchOutcome {
  html: string;
  traces: Trace[];
  via: string;
}

async function fetchText(target: string, parent: AbortSignal | undefined, log: LogSink, timeout = 16000): Promise<FetchOutcome | null> {
  const traces: Trace[] = [];
  for (const r of RELAYS) {
    const t0 = performance.now();
    const url = r.build(target);
    try {
      log(`GET ${target.replace("https://", "")} → via ${r.via} …`, "dim");
      const res = await fetchWithTimeout(url, parent, timeout);
      const text = await res.text();
      const ms = Math.round(performance.now() - t0);
      traces.push({ via: r.via, url, status: res.status, bytes: text.length, ms, ok: res.ok && text.length > 400 });
      if (res.ok && text.length > 400) {
        log(`✓ ${r.via} relay → ${res.status} · ${(text.length / 1024).toFixed(1)} KB · ${ms} ms`, "ok");
        return { html: text, traces, via: r.via };
      }
      log(`✗ ${r.via} relay → HTTP ${res.status} · ${ms} ms`, "warn");
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      traces.push({ via: r.via, url, status: "ERR", bytes: 0, ms, ok: false });
      if (parent?.aborted) throw e;
      log(`✗ ${r.via} relay → ${(e as Error).name} · ${ms} ms`, "warn");
    }
  }
  return traces.length ? { html: "", traces, via: "none" } : null;
}

/* ------------------------------------------------------------------ */
/*  date helpers                                                       */
/* ------------------------------------------------------------------ */

const MONTHS_RE = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/i;
const MONTH_IDX: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function parseMonthYear(s: string): { m: number; y: number } | null {
  const mm = s.match(new RegExp(`(${MONTHS_RE.source})\\.?\\s+(\\d{4})`, "i"));
  if (!mm) {
    const yOnly = s.match(/\b(19|20)\d{2}\b/);
    if (yOnly) return { m: 0, y: Number(yOnly[0]) };
    return null;
  }
  return { m: MONTH_IDX[mm[1].slice(0, 3).toLowerCase()], y: Number(mm[2]) };
}

const DATE_RANGE_RE = new RegExp(
  `((?:${MONTHS_RE.source})\\.?\\s+\\d{4}|\\b(?:19|20)\\d{2}\\b)\\s*(?:-|–|—|to)\\s*((?:${MONTHS_RE.source})\\.?\\s+\\d{4}|Present|present|Now)`,
);

function durationFromRange(range: string): string | null {
  const m = range.match(DATE_RANGE_RE);
  if (!m) return null;
  const s = parseMonthYear(m[1]);
  if (!s) return null;
  const now = new Date();
  const e = /present|now/i.test(m[2]) ? { m: now.getMonth(), y: now.getFullYear() } : parseMonthYear(m[2]);
  if (!e) return null;
  const months = Math.max(1, (e.y - s.y) * 12 + (e.m - s.m) + 1);
  const y = Math.floor(months / 12);
  const mo = months % 12;
  if (y === 0) return `${mo} mo${mo > 1 ? "s" : ""}`;
  if (mo === 0) return `${y} yr${y > 1 ? "s" : ""}`;
  return `${y} yr${y > 1 ? "s" : ""} ${mo} mos`;
}

/* ------------------------------------------------------------------ */
/*  Jina Reader → markdown of the rendered LinkedIn page               */
/* ------------------------------------------------------------------ */

interface JinaDoc {
  title: string;
  content: string;
  url: string;
}

function parseJinaPlainText(txt: string): JinaDoc {
  let title = "";
  let url = "";
  const lines = txt.split("\n");
  let start = 0;
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    if (/^Title:\s*/i.test(lines[i])) title = lines[i].replace(/^Title:\s*/i, "").trim();
    else if (/^URL Source:\s*/i.test(lines[i])) url = lines[i].replace(/^URL Source:\s*/i, "").trim();
    else if (/^Markdown Content:\s*/i.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  return { title, content: lines.slice(start).join("\n"), url };
}

async function fetchJina(targetUrl: string, parent: AbortSignal | undefined, log: LogSink): Promise<{ doc: JinaDoc; trace: Trace }> {
  const t0 = performance.now();
  const url = `https://r.jina.ai/${targetUrl}`;
  log(`GET ${targetUrl.replace("https://", "")} → via jina-reader (rendered page) …`, "dim");
  try {
    const res = await fetchWithTimeout(url, parent, 30000, { headers: { Accept: "application/json" } });
    const txt = await res.text();
    const ms = Math.round(performance.now() - t0);
    const trace: Trace = { via: "jina-reader", url, status: res.status, bytes: txt.length, ms, ok: res.ok };
    if (!res.ok) {
      log(`✗ jina-reader → HTTP ${res.status} · ${ms} ms`, "warn");
      return { doc: { title: "", content: "", url: targetUrl }, trace };
    }
    let doc: JinaDoc;
    try {
      const j = JSON.parse(txt);
      doc = { title: j?.data?.title ?? "", content: j?.data?.content ?? "", url: j?.data?.url ?? targetUrl };
    } catch {
      doc = parseJinaPlainText(txt);
    }
    log(`✓ jina-reader → 200 · ${(txt.length / 1024).toFixed(1)} KB rendered markdown · ${ms} ms`, "ok");
    return { doc, trace: { ...trace, bytes: doc.content.length } };
  } catch (e) {
    if (parent?.aborted) throw e;
    const ms = Math.round(performance.now() - t0);
    log(`✗ jina-reader → ${(e as Error).name} · ${ms} ms`, "warn");
    return { doc: { title: "", content: "", url: targetUrl }, trace: { via: "jina-reader", url, status: "ERR", bytes: 0, ms, ok: false } };
  }
}

/* ---------- jina markdown → structured profile sections ---------- */

const SECTIONS: [RegExp, string][] = [
  [/^#{1,4}\s*About\b/i, "about"],
  [/^#{1,4}\s*Experience\b/i, "experience"],
  [/^#{1,4}\s*Education\b/i, "education"],
  [/^#{1,4}\s*Skills\b/i, "skills"],
  [/^#{1,4}\s*Projects?\b/i, "projects"],
  [/^#{1,4}\s*(Licenses?\s*[&amp;]*\s*certifications?|Certifications?)\b/i, "certs"],
  [/^#{1,4}\s*(Honors?[- ]?[&a-zA-Z ]*awards?|Awards?)\b/i, "honors"],
  [/^#{1,4}\s*Volunteer experience\b/i, "volunteer"],
  [/^#{1,4}\s*Recommendations received\b/i, "recommendations"],
  [/^#{1,4}\s*Recommendations\b/i, "recommendations"],
  [/^#{1,4}\s*(Recent activity|Activity)\b/i, "activity"],
  [/^#{1,4}\s*Organizations?\b/i, "organizations"],
  [/^#{1,4}\s*Publications?\b/i, "publications"],
  [/^#{1,4}\s*Patents?\b/i, "patents"],
  [/^#{1,4}\s*Courses?\b/i, "courses"],
  [/^#{1,4}\s*Test scores?\b/i, "testscores"],
  [/^#{1,4}\s*Languages?\b/i, "languages"],
];

/* LinkedIn / Jina often emits section labels as plain text, not # headings */
const SECTION_PLAIN: Record<string, string> = {
  about: "about",
  experience: "experience",
  education: "education",
  skills: "skills",
  projects: "projects",
  "licenses & certifications": "certs",
  "licenses and certifications": "certs",
  certifications: "certs",
  "honors & awards": "honors",
  "honors-awards": "honors",
  "honors and awards": "honors",
  awards: "honors",
  "volunteer experience": "volunteer",
  volunteering: "volunteer",
  "recommendations received": "recommendations",
  recommendations: "recommendations",
  "recent activity": "activity",
  activity: "activity",
  organizations: "organizations",
  publications: "publications",
  patents: "patents",
  courses: "courses",
  "test scores": "testscores",
  languages: "languages",
};

interface ProfileSections {
  heading: string;
  blocks: Record<string, string[]>;
  preamble: string[];
  links: { text: string; href: string }[];
}

function splitSections(content: string): ProfileSections {
  const lines = content.split("\n");
  const blocks: Record<string, string[]> = {};
  const preamble: string[] = [];
  let current: string | null = null;
  let heading = "";

  for (const raw of lines) {
    const line = raw.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, t, h) => {
      // keep visible text, collect link separately
      return t || h;
    });
    if (!heading && /^#\s+[^#]/.test(line)) heading = line.replace(/^#\s+/, "").trim();

    let matched = false;
    for (const [re, key] of SECTIONS) {
      if (re.test(line)) {
        current = key;
        blocks[key] = blocks[key] ?? [];
        matched = true;
        break;
      }
    }
    if (!matched) {
      const norm = line.replace(/^#{1,4}\s*/, "").replace(/\*\*/g, "").trim().toLowerCase();
      const key = SECTION_PLAIN[norm];
      if (key) {
        current = key;
        blocks[key] = blocks[key] ?? [];
        matched = true;
      }
    }
    if (matched) continue;

    const trimmed = line.trim();
    if (!trimmed) {
      if (current) blocks[current].push("");
      continue;
    }
    // skip chrome/nav noise
    if (/^(Join now|Sign in|LinkedIn|Skip to main content|Agree & Join|Show all|…more|\.\.\.more|Main content starts here)/i.test(trimmed)) continue;
    if (current) blocks[current].push(trimmed);
    else if (preamble.length < 40) preamble.push(trimmed);
  }

  // collect markdown links from the raw content for external profiles
  const links: { text: string; href: string }[] = [];
  const linkRe = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(content)) !== null) links.push({ text: lm[1], href: lm[2] });

  return { heading, blocks, preamble, links };
}

function chunkEntries(lines: string[]): string[][] {
  // An entry starts at a bold line (**Name**), a ###/#### heading, or a
  // "title-like" line immediately followed by a company/type or date line.
  const chunks: string[][] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) {
      chunks.push(cur);
      cur = [];
    }
  };

  const isBullet = (l: string) => /^[•·*-]\s?/.test(l);
  const isCoType = (l: string) =>
    /·\s*(Full-time|Part-time|Internship|Contract|Self-employed|Freelance|Seasonal)/i.test(l);
  const isDate = (l: string) => DATE_RANGE_RE.test(l);
  const isTitlelike = (l: string) =>
    l.length >= 3 &&
    l.length <= 140 &&
    !isBullet(l) &&
    !isCoType(l) &&
    !isDate(l) &&
    !/^(Skills|Grade|Activities and societies|Cause|Description|Show|Issued|Expires|Credential ID|Role|Organization|Employment Type):?/i.test(l) &&
    !/,\s/.test(l);

  const nextTwo = (i: number): string[] => {
    const out: string[] = [];
    for (let j = i + 1; j < lines.length && out.length < 2; j++) {
      const t = lines[j].trim();
      if (t) out.push(t);
    }
    return out;
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    const boldOrHead = /^\*\*.+\*\*/.test(l) || /^#{3,4}\s/.test(l);
    let boundary = boldOrHead;
    if (!boundary && cur.length > 0 && isTitlelike(l)) {
      const [n1, n2] = nextTwo(i);
      boundary =
        (!!n1 && (isCoType(n1) || isDate(n1))) ||
        (!!n2 && (isCoType(n2) || isDate(n2)));
    }
    if (boundary) flush();
    cur.push(l);
  }
  flush();
  return chunks;
}

const clean = (s: string) => s.replace(/\*\*/g, "").replace(/^#{1,5}\s*/, "").replace(/\s+/g, " ").trim();

/* ------------------------------------------------------------------ */
/*  LinkedIn builder — real fields only                                */
/* ------------------------------------------------------------------ */

const AUTH_NOTE = "Not in the anonymous response — LinkedIn locks this behind login. maxun-core (Phase 01.5) fetches it with your session cookie.";

function authField(label: string, src: string): Field {
  return { label, kind: "text", status: "auth", conf: 0, source: src, note: AUTH_NOTE };
}
function missingField(label: string, src: string, note: string): Field {
  return { label, kind: "text", status: "missing", conf: 0, source: src, note };
}
function found(label: string, kind: Field["kind"], value: string | string[], source: string, conf: number): Field {
  const f: Field = { label, kind, status: "found", conf, source };
  if (kind === "chips" || kind === "lines") f.values = Array.isArray(value) ? value : [value];
  else f.value = Array.isArray(value) ? value.join(" ") : value;
  return f;
}

interface LiHarvest {
  name: string | null;
  headline: string | null;
  location: string | null;
  photo: string | null;
  about: string[];
  wall: boolean;
  via: string;
  expEntries: Field[][];
  expMeta: { title: string; company: string; type: string; range: string; duration: string | null; loc: string | null; bullets: string[]; skills: string[] }[];
  eduEntries: Field[][];
  eduMeta: { school: string; detail: string; range: string; grade: string | null; activities: string | null }[];
  skills: string[];
  projEntries: Field[][];
  certEntries: Field[][];
  honorEntries: Field[][];
  volunteerEntries: Field[][];
  recommendations: string[];
  activity: string[];
  organizations: string[];
  publications: string[];
  patents: string[];
  languages: string[];
  externalLinks: { text: string; href: string }[];
  openToWork: boolean;
  aboutMeta: string | null;
}

function emptyHarvest(via: string): LiHarvest {
  return {
    name: null, headline: null, location: null, photo: null, about: [], wall: false, via,
    expEntries: [], expMeta: [], eduEntries: [], eduMeta: [], skills: [], projEntries: [],
    certEntries: [], honorEntries: [], volunteerEntries: [], recommendations: [], activity: [],
    organizations: [], publications: [], patents: [], languages: [], externalLinks: [], openToWork: false, aboutMeta: null,
  };
}

/* ---------- parse Jina markdown of the public profile ---------- */

function parseJinaMarkdown(doc: JinaDoc, slug: string): LiHarvest {
  const h = emptyHarvest("jina-reader");
  const content = doc.content;
  if (!content || content.length < 200) return h;

  // authwall detection on the rendered page
  const wallish = /authwall/i.test(content) || /Agree & Join LinkedIn/i.test(content) || /Sign Up \| LinkedIn/i.test(doc.title);
  const hasSections = SECTIONS.some(([re]) => re.test(content));
  h.wall = wallish && !hasSections;

  const { heading, blocks, preamble, links } = splitSections(content);
  h.externalLinks = links;
  h.openToWork = /open to work/i.test(content);

  // identity from rendered heading / jina title
  const titleSrc = (doc.title || "").replace(/\s*[|·]\s*LinkedIn\s*$/i, "").trim();
  if (titleSrc && !/sign up|join linkedin/i.test(titleSrc)) {
    const dash = titleSrc.indexOf(" - ");
    h.name = dash > 0 ? titleSrc.slice(0, dash).trim() : titleSrc;
    if (dash > 0) h.headline = titleSrc.slice(dash + 3).trim();
  }
  if (heading && !h.name) h.name = clean(heading);
  // headline fallback: preamble line right under the name
  if (!h.headline) {
    const cand = preamble.find((l) => l.length > 8 && l.length < 220 && !/@|connections|followers/i.test(l) && !/^\d/.test(l) && l !== h.name);
    if (cand) h.headline = clean(cand);
  }
  // location: "City, Country" pattern in preamble
  const locCand = preamble.find((l) => /,\s*[A-Za-z ]+$/.test(l) && l.length < 80 && !/linkedin/i.test(l) && !/·/.test(l) && l !== h.name && l !== h.headline);
  if (locCand) h.location = clean(locCand);

  /* about */
  if (blocks.about) h.about = blocks.about.map(clean).filter((s) => s && !/^\d+ (reactions|comments)/.test(s)).slice(0, 8);

  /* experience */
  if (blocks.experience) {
    for (const chunk of chunkEntries(blocks.experience)) {
      const title = clean(chunk[0]);
      let company = "", type = "", range = "", loc: string | null = null;
      const bullets: string[] = [];
      const skills: string[] = [];
      for (const l of chunk.slice(1)) {
        const t = clean(l);
        if (!t) continue;
        const rm = t.match(DATE_RANGE_RE);
        if (rm && !range) { range = rm[0]; continue; }
        if (/^(Full-time|Part-time|Internship|Contract|Self-employed|Freelance|Seasonal)/i.test(t) && !type) { type = t; continue; }
        if (/^Skills:/i.test(t)) { skills.push(...t.replace(/^Skills:/i, "").split(/[·,]/).map((x) => clean(x)).filter(Boolean)); continue; }
        if (/^[•·-]\s?/.test(t)) { bullets.push(t.replace(/^[•·-]\s?/, "")); continue; }
        if (/,/.test(t) && t.length < 70 && !loc) { loc = t; continue; }
        if (!company && t.length < 140) {
          const parts = t.split("·").map((x) => clean(x)).filter(Boolean);
          company = parts[0] ?? t;
          const typeTok = parts.slice(1).find((p) => /^(Full-time|Part-time|Internship|Contract|Self-employed|Freelance|Seasonal)/i.test(p));
          if (typeTok && !type) type = typeTok;
          continue;
        }
      }
      if (!title) continue;
      const srcBase = `r.jina.ai → Experience > “${title.slice(0, 38)}”`;
      const src = (sel: string) => `${srcBase} ${sel}`;
      const fs: Field[] = [];
      fs.push(found("Job Title", "text", title, src("(entry heading)"), 0.88));
      if (company) fs.push(found("Company", "text", company.split("·")[0].trim(), src("(company line)"), 0.82));
      if (type) fs.push(found("Employment Type", "text", type, src("(type token)"), 0.78));
      if (range) {
        const parts = range.split(/\s*(?:-|–|—|to)\s*/);
        fs.push(found("Start Date", "text", parts[0]?.trim() ?? range, src("(date range)"), 0.85));
        fs.push(found("End Date", "text", parts[1]?.trim() ?? "Present", src("(date range)"), 0.85));
      }
      const dur = range ? durationFromRange(range) : null;
      if (dur) {
        const f = found("Duration", "text", dur, src("(derived from range)"), 0.8);
        f.status = "derived";
        fs.push(f);
      }
      if (loc) fs.push(found("Role Location", "text", loc, src("(location line)"), 0.7));
      if (bullets.length) fs.push(found("Responsibilities", "lines", bullets.slice(0, 6), src("(bullet list)"), 0.72));
      if (skills.length) fs.push(found("Technologies Used", "chips", skills.slice(0, 10), src("(“Skills:” line)"), 0.78));
      h.expEntries.push(fs);
      h.expMeta.push({ title, company, type, range, duration: dur, loc, bullets, skills });
    }
  }

  /* education */
  if (blocks.education) {
    for (const chunk of chunkEntries(blocks.education)) {
      const school = clean(chunk[0]);
      let detail = "", range = "", grade: string | null = null, activities: string | null = null;
      for (const l of chunk.slice(1)) {
        const t = clean(l);
        if (!t) continue;
        const rm = t.match(DATE_RANGE_RE);
        if (rm && !range) { range = rm[0]; continue; }
        if (/^Grade:/i.test(t)) { grade = t.replace(/^Grade:/i, "").trim(); continue; }
        if (/^Activities and societies:/i.test(t)) { activities = t.replace(/^Activities and societies:/i, "").trim(); continue; }
        if (/^(Skills:|Show more)/i.test(t)) continue;
        if (!detail && t.length < 160) { detail = t; continue; }
      }
      if (!school) continue;
      const srcBase = `r.jina.ai → Education > “${school.slice(0, 34)}”`;
      const fs: Field[] = [found("University", "text", school, `${srcBase} (entry heading)`, 0.88)];
      if (detail) {
        const parts = detail.split(",").map((x) => x.trim());
        fs.push(found("Degree", "text", parts[0], `${srcBase} (degree line)`, 0.84));
        if (parts[1]) fs.push(found("Field of Study", "text", parts.slice(1).join(", "), `${srcBase} (degree line)`, 0.82));
      }
      if (range) {
        const parts = range.split(/\s*(?:-|–|—|to)\s*/);
        const sy = parts[0]?.match(/\d{4}/)?.[0];
        const ey = /present/i.test(parts[1] ?? "") ? "Present" : parts[1]?.match(/\d{4}/)?.[0];
        if (sy) fs.push(found("Start Year", "text", sy, `${srcBase} (date range)`, 0.82));
        if (ey) fs.push(found("Graduation Year", "text", ey, `${srcBase} (date range)`, 0.82));
      }
      if (grade) fs.push(found("GPA / Grade", "text", grade, `${srcBase} (Grade:)`, 0.8));
      if (activities) fs.push(found("Activities", "text", activities, `${srcBase} (Activities line)`, 0.74));
      h.eduEntries.push(fs);
      h.eduMeta.push({ school, detail, range, grade, activities });
    }
  }

  /* skills */
  if (blocks.skills) {
    for (const l of blocks.skills) {
      const t = clean(l);
      if (!t || /^(Show all|Top skills|\d+ endorsement)/i.test(t)) continue;
      const tokens = t.split(/\s*·\s*|\s*,\s*/).map((x) => clean(x)).filter((x) => x && x.length < 60 && !/endorsement/i.test(x));
      h.skills.push(...tokens);
    }
    h.skills = [...new Set(h.skills)].slice(0, 40);
  }

  /* projects */
  if (blocks.projects) {
    for (const chunk of chunkEntries(blocks.projects)) {
      const name = clean(chunk[0]);
      if (!name) continue;
      let desc = "", range = "", link: string | null = null;
      for (const l of chunk.slice(1)) {
        const t = clean(l);
        if (!t) continue;
        if (/^https?:\/\//.test(t) || /Show project/i.test(t)) {
          const um = t.match(/https?:\/\/[^\s)]+/);
          if (um) link = um[0];
          continue;
        }
        const rm = t.match(DATE_RANGE_RE);
        if (rm && !range) { range = rm[0]; continue; }
        if (!desc && t.length > 10) { desc = t; continue; }
      }
      const srcBase = `r.jina.ai → Projects > “${name.slice(0, 34)}”`;
      const fs: Field[] = [found("Project Name", "text", name, `${srcBase} (entry heading)`, 0.86)];
      if (desc) fs.push(found("Description", "text", desc, `${srcBase} (body)`, 0.78));
      if (range) fs.push(found("Project Duration", "text", range, `${srcBase} (date range)`, 0.74));
      if (link) fs.push(found("Link", "link", link, `${srcBase} (href)`, 0.9));
      h.projEntries.push(fs);
    }
  }

  /* certifications */
  if (blocks.certs) {
    for (const chunk of chunkEntries(blocks.certs)) {
      const name = clean(chunk[0]);
      if (!name) continue;
      let issuer = "", issued = "", credId: string | null = null, expires = "";
      for (const l of chunk.slice(1)) {
        const t = clean(l);
        if (/^Issued\s/i.test(t)) { issued = t.replace(/^Issued\s*/i, "").replace(/\s*·.*$/, ""); continue; }
        if (/^Expires?\s/i.test(t)) { expires = t.replace(/^Expires?\s*/i, ""); continue; }
        if (/^Credential ID\s/i.test(t)) { credId = t.replace(/^Credential ID\s*/i, ""); continue; }
        if (/^(Show credential|Skills:)/i.test(t)) continue;
        if (!issuer && t.length < 120) issuer = t;
      }
      const srcBase = `r.jina.ai → Certifications > “${name.slice(0, 34)}”`;
      const fs: Field[] = [found("Certification Name", "text", name, `${srcBase} (entry heading)`, 0.88)];
      if (issuer) fs.push(found("Issuing Organization", "text", issuer, `${srcBase} (issuer line)`, 0.84));
      if (issued) fs.push(found("Issue Date", "text", issued, `${srcBase} (Issued)`, 0.84));
      if (expires) fs.push(found("Expiry Date", "text", expires, `${srcBase} (Expires)`, 0.8));
      if (credId) fs.push(found("Credential ID", "text", credId, `${srcBase} (Credential ID)`, 0.86));
      h.certEntries.push(fs);
    }
  }

  /* honors */
  if (blocks.honors) {
    for (const chunk of chunkEntries(blocks.honors)) {
      const name = clean(chunk[0]);
      if (!name) continue;
      let issuer = "", when = "", desc = "";
      for (const l of chunk.slice(1)) {
        const t = clean(l);
        const ym = t.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\b/i);
        if (ym && !when) { when = ym[0]; continue; }
        if (!issuer && t.length < 120) { issuer = t; continue; }
        if (!desc && t.length > 12) desc = t;
      }
      const srcBase = `r.jina.ai → Honors-Awards > “${name.slice(0, 34)}”`;
      const fs: Field[] = [found("Award / Honor", "text", name, `${srcBase} (entry heading)`, 0.85)];
      if (issuer) fs.push(found("Issuer", "text", issuer, `${srcBase} (issuer line)`, 0.78));
      if (when) fs.push(found("Date", "text", when, `${srcBase} (date)`, 0.78));
      if (desc) fs.push(found("Description", "text", desc, `${srcBase} (body)`, 0.7));
      h.honorEntries.push(fs);
    }
  }

  /* volunteer */
  if (blocks.volunteer) {
    for (const chunk of chunkEntries(blocks.volunteer)) {
      const role = clean(chunk[0]);
      if (!role) continue;
      let org = "", range = "", cause = "", desc = "";
      for (const l of chunk.slice(1)) {
        const t = clean(l);
        const rm = t.match(DATE_RANGE_RE);
        if (rm && !range) { range = rm[0]; continue; }
        if (/^Cause:/i.test(t)) { cause = t.replace(/^Cause:/i, "").trim(); continue; }
        if (!org && t.length < 120) { org = t; continue; }
        if (!desc && t.length > 12) desc = t;
      }
      const srcBase = `r.jina.ai → Volunteer > “${role.slice(0, 34)}”`;
      const fs: Field[] = [found("Role", "text", role, `${srcBase} (entry heading)`, 0.84)];
      if (org) fs.push(found("Organization", "text", org, `${srcBase} (org line)`, 0.8));
      if (range) fs.push(found("Period", "text", range, `${srcBase} (date range)`, 0.78));
      if (cause) fs.push(found("Cause", "text", cause, `${srcBase} (Cause:)`, 0.75));
      if (desc) fs.push(found("Description", "text", desc, `${srcBase} (body)`, 0.7));
      h.volunteerEntries.push(fs);
    }
  }

  /* recommendations */
  if (blocks.recommendations) {
    h.recommendations = blocks.recommendations.map(clean).filter((t) => t && t.length > 8).slice(0, 6);
  }
  /* activity */
  if (blocks.activity) {
    h.activity = blocks.activity.map(clean).filter((t) => t && t.length > 6 && !/^(Show all|likes|reactions)/i.test(t)).slice(0, 6);
  }
  if (blocks.organizations) h.organizations = blocks.organizations.map(clean).filter(Boolean).slice(0, 8);
  if (blocks.publications) h.publications = chunkEntries(blocks.publications).map((c) => clean(c[0])).filter(Boolean).slice(0, 5);
  if (blocks.patents) h.patents = chunkEntries(blocks.patents).map((c) => clean(c[0])).filter(Boolean).slice(0, 5);
  if (blocks.languages) h.languages = blocks.languages.map(clean).filter(Boolean).slice(0, 6);

  // profile photo sometimes appears in markdown as an image link
  const img = content.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
  if (img) h.photo = img[1];
  void slug;
  return h;
}

/* ---------- parse raw HTML (relay path / pasted page source) ---------- */

function parsePublicHtml(html: string, slug: string): LiHarvest {
  const h = emptyHarvest("raw HTML");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const q = (s: string) => doc.querySelector(s);

  const wall = !!(q('meta[name="pageKey"][content*="authwall"], div#authwall-container, section.authentication__content') || /authwall/i.test(html) || (doc.title || "").includes("Sign Up"));
  const ogTitle = q('meta[property="og:title"]')?.getAttribute("content") ?? "";
  const ogDesc = q('meta[property="og:description"]')?.getAttribute("content") ?? "";
  const metaDesc = q('meta[name="description"]')?.getAttribute("content") ?? "";
  const ogImage = q('meta[property="og:image"]')?.getAttribute("content") ?? null;

  const titleSrc = (ogTitle || doc.title || "").replace(/\s*[|·]\s*LinkedIn\s*$/i, "").trim();
  if (titleSrc && !/sign up|join linkedin/i.test(titleSrc)) {
    const dash = titleSrc.indexOf(" - ");
    h.name = dash > 0 ? titleSrc.slice(0, dash).trim() : titleSrc;
    if (dash > 0) h.headline = titleSrc.slice(dash + 3).trim();
  }

  // og:description is typically "Location · 500+ connections"
  const locM = ogDesc.match(/^(.+?)\s*·\s*[\d,+\s]+ connections?/i);
  if (locM) h.location = locM[1].trim();

  if (metaDesc && !wall) {
    // "View X's profile … X has N jobs listed … <about snippet>"
    h.aboutMeta = metaDesc;
    const aboutM = metaDesc.match(/profile[^.]*\.\s*(.+)$/);
    if (aboutM) h.about = [aboutM[1].trim()];
  }
  if (ogImage) h.photo = ogImage;

  // JSON-LD Person
  for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const j = JSON.parse(s.textContent ?? "{}");
      const person = Array.isArray(j) ? j.find((x) => x?.["@type"] === "Person") : j?.["@type"] === "Person" ? j : null;
      if (person) {
        if (!h.name && person.name) h.name = person.name;
        if (!h.headline && person.jobTitle) h.headline = person.jobTitle;
        if (!h.location && person.address) {
          h.location = typeof person.address === "string" ? person.address : [person.address.addressLocality, person.address.addressCountry?.name].filter(Boolean).join(", ");
        }
        if (person.sameAs) h.externalLinks = (person.sameAs as string[]).map((href) => ({ text: "", href }));
        if (person.image && !h.photo) h.photo = typeof person.image === "string" ? person.image : person.image.url;
      }
    } catch {
      /* non-JSON script */
    }
  }

  h.wall = wall && !h.about.length && !h.name;
  // attempt to find SSR-rendered sections (present when the profile is fully public)
  const secText = (sel: string) => Array.from(doc.querySelectorAll(sel)).map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const liAbout = secText('section[class*="summary"] p, div[class*="about"] p, #about p');
  if (liAbout.length && !h.about.length) h.about = liAbout.slice(0, 6);
  void slug;
  return h;
}

/* ---------- assemble LinkedIn modules from harvested real fields ---------- */

function entryMeta(exp: LiHarvest["expMeta"][number]): string {
  return [exp.type, exp.range, exp.duration].filter(Boolean).join(" · ");
}

function buildLinkedInModules(h: LiHarvest, slug: string, url: string): ModuleData[] {
  const S = (sel: string) => `linkedin.com/in/${slug} → ${sel}`;
  const mods: ModuleData[] = [];
  const wall = h.wall;
  const srcTag = h.via === "jina-reader" ? "rendered page" : "public HTML";

  /* identity */
  const identityFields: Field[] = [];
  identityFields.push(
    h.name ? found("Full Name", "text", h.name, `${h.via} → og:title / h1`, 0.97) : missingField("Full Name", S("og:title"), wall ? "authwall response" : "not in public shell"),
  );
  identityFields.push(
    h.headline ? found("Headline", "text", h.headline, `${h.via} → og:title`, 0.93) : missingField("Headline", S("og:title"), wall ? "authwall response" : "not in public shell"),
  );
  if (h.about.length) identityFields.push(found("About / Bio", "text", h.about.join(" "), `${h.via} → About section / meta[description]`, 0.88));
  else identityFields.push(authField("About / Bio", S("div.about")));
  identityFields.push(
    h.location ? found("Location", "text", h.location, `${h.via} → og:description`, 0.9) : authField("Location", S("span.pb2")),
  );
  const locParts = (h.location ?? "").split(",").map((x) => x.trim());
  if (h.location && locParts.length >= 2) {
    identityFields.push(found("Country", "text", locParts[locParts.length - 1], `${h.via} → og:description (derived)`, 0.8));
    identityFields.push(found("City", "text", locParts[0], `${h.via} → og:description (derived)`, 0.8));
  } else {
    identityFields.push(authField("Country", S("meta[itemprop=addressCountry]")));
    identityFields.push(authField("City", S("meta[itemprop=addressLocality]")));
  }
  if (h.expMeta.length) {
    identityFields.push(found("Current Role", "text", h.expMeta[0].title, `${h.via} → Experience[0] heading`, 0.85));
    if (h.expMeta[0].company) identityFields.push(found("Current Company", "text", h.expMeta[0].company, `${h.via} → Experience[0] company line`, 0.8));
  } else {
    identityFields.push(authField("Current Role", S("div.pv-text-details h2")));
    identityFields.push(authField("Current Company", S("span[aria-label*=Current]")));
  }
  identityFields.push(authField("Industry", S("span.industry")));
  identityFields.push(found("Profile URL", "link", url, "canonical URL (constructed)", 0.99));
  if (h.languages.length) identityFields.push(found("Languages", "chips", h.languages, `${h.via} → Languages section`, 0.8));

  mods.push({
    id: "identity", name: "Identity & Basics", icon: "fingerprint",
    summary: `from ${srcTag}${wall ? " · authwall limited" : ""}`,
    fields: identityFields,
  });

  /* experience */
  mods.push({
    id: "experience", name: "Experience", icon: "briefcase",
    summary: h.expEntries.length ? `${h.expEntries.length} roles parsed from ${srcTag}` : wall ? "locked behind authwall" : "none in public shell",
    fields: [],
    entries: h.expEntries.length
      ? h.expEntries.map((fields, i) => ({
          title: h.expMeta[i].title,
          subtitle: [h.expMeta[i].company, h.expMeta[i].type].filter(Boolean).join(" · "),
          meta: [h.expMeta[i].range, h.expMeta[i].duration].filter(Boolean).join(" · "),
          fields,
        }))
      : undefined,
  });
  if (!h.expEntries.length) mods[mods.length - 1].fields = [authField("Experience entries", S("section#experience-section"))];

  /* skills */
  mods.push({
    id: "skills", name: "Skills", icon: "chip",
    summary: h.skills.length ? `${h.skills.length} skills listed on public profile` : wall ? "locked behind authwall" : "not in public shell",
    fields: h.skills.length
      ? [found("Skills (public list)", "chips", h.skills, `${h.via} → Skills section`, 0.86)]
      : [authField("Skills + endorsements", S("section.pv-skill-categories"))],
  });

  /* education */
  mods.push({
    id: "education", name: "Education", icon: "cap",
    summary: h.eduEntries.length ? `${h.eduEntries.length} institution${h.eduEntries.length > 1 ? "s" : ""} parsed` : wall ? "locked behind authwall" : "none in public shell",
    fields: h.eduEntries.length ? [] : [authField("Education entries", S("section#education-section"))],
    entries: h.eduEntries.length
      ? h.eduEntries.map((fields, i) => ({
          title: h.eduMeta[i].school,
          subtitle: h.eduMeta[i].detail || undefined,
          meta: h.eduMeta[i].range || undefined,
          fields,
        }))
      : undefined,
  });

  /* projects */
  mods.push({
    id: "projects", name: "Projects", icon: "rocket",
    summary: h.projEntries.length ? `${h.projEntries.length} projects listed on profile` : wall ? "locked behind authwall" : "none listed on public profile",
    fields: h.projEntries.length ? [] : [missingField("Projects", S("section#projects-section"), "No Projects section in the anonymous response (GitHub tab covers repos live).")],
    entries: h.projEntries.length ? h.projEntries.map((fields) => ({ title: fields[0].value ?? "Project", fields: fields.slice(1) })) : undefined,
  });

  /* achievements */
  const achFields: Field[] = [];
  if (h.honorEntries.length) {
    achFields.push(found("Honors & Awards", "lines", h.honorEntries.map((f) => f[0].value ?? ""), `${h.via} → Honors-Awards section`, 0.82));
  } else achFields.push(authField("Awards / Hackathons", S("div.pv-accomplishments-block")));
  if (h.publications.length) achFields.push(found("Publications", "lines", h.publications, `${h.via} → Publications section`, 0.8));
  else achFields.push(missingField("Publications", S("div.pv-accomplishments-block--publication"), "None in anonymous response."));
  if (h.patents.length) achFields.push(found("Patents", "lines", h.patents, `${h.via} → Patents section`, 0.8));
  else achFields.push(missingField("Patents", S("div.pv-accomplishments-block--patent"), "None in anonymous response."));
  achFields.push(authField("Competitions / Scholarships detail", S("div.pv-accomplishments-block")));
  mods.push({ id: "achievements", name: "Achievements", icon: "trophy", summary: `${h.honorEntries.length} honors · ${h.publications.length} publications live`, fields: achFields });

  /* certifications */
  mods.push({
    id: "certifications", name: "Certifications", icon: "ribbon",
    summary: h.certEntries.length ? `${h.certEntries.length} credentials parsed` : wall ? "locked behind authwall" : "none in public shell",
    fields: h.certEntries.length ? [] : [authField("Certifications", S("section#certifications-section"))],
    entries: h.certEntries.length ? h.certEntries.map((fields) => ({ title: fields[0].value ?? "Certification", subtitle: fields[1]?.value, fields: fields.slice(1) })) : undefined,
  });

  /* signals */
  const sigFields: Field[] = [];
  if (h.openToWork) sigFields.push(found("Open to Work", "text", "Yes — #OpenToWork signal present on public profile", `${h.via} → “Open to work” badge text`, 0.9));
  else sigFields.push(missingField("Open to Work", S("div.pv-open-to-work__badge"), "No public #OpenToWork signal detected in the anonymous response."));
  const rest: [string, string][] = [
    ["Preferred Job Titles", "div.pv-open-to-work__job-titles"],
    ["Preferred Locations", "div.pv-open-to-work__locations"],
    ["Remote Preference", "span[data-remote-pref]"],
    ["Relocation Preference", "span[data-relocation]"],
    ["Employment Type", "div.pv-open-to-work__types"],
    ["Industries Interested In", "div.pv-open-to-work__industries"],
    ["Career Interests", "div.pv-career-interests"],
    ["Seniority Preference", "span[data-seniority]"],
  ];
  for (const [label, sel] of rest) sigFields.push(authField(label, S(sel)));
  mods.push({
    id: "signals", name: "Professional Signals", icon: "radar",
    summary: h.openToWork ? "Open to work — actively signaling" : "recruiter-only signals locked",
    fields: sigFields,
  });

  /* network */
  const netFields: Field[] = [];
  if (h.organizations.length) netFields.push(found("Organizations", "chips", h.organizations, `${h.via} → Organizations section`, 0.8));
  else netFields.push(missingField("Organizations", S("div.pv-accomplishments-block--organization"), "None in anonymous response."));
  if (h.volunteerEntries.length) netFields.push(found("Volunteer Experience", "lines", h.volunteerEntries.map((f) => [f[0].value, f[1]?.value].filter(Boolean).join(" — ")), `${h.via} → Volunteer section`, 0.78));
  else netFields.push(authField("Volunteer Experience", S("div.volunteering-section")));
  if (h.recommendations.length) netFields.push(found("Recommendations Received", "lines", h.recommendations, `${h.via} → Recommendations section`, 0.8));
  else netFields.push(authField("Recommendations Received", S("div.pv-recommendations-tab")));
  netFields.push(authField("Communities / Associations", S("div.pv-profile-section")));
  mods.push({ id: "network", name: "Network", icon: "nodes", summary: `${h.volunteerEntries.length} volunteer · ${h.recommendations.length} recommendations live`, fields: netFields });

  /* content */
  const ctFields: Field[] = [];
  if (h.activity.length) ctFields.push(found("Recent Activity", "lines", h.activity, `${h.via} → Activity section`, 0.74));
  else ctFields.push(authField("Posts / Articles / Activity", S("div.pv-recent-activity-section")));
  ctFields.push(authField("Topics Discussed", S("div.pv-browsemap-section")));
  mods.push({ id: "content", name: "Content & Activity", icon: "pen", summary: h.activity.length ? `${h.activity.length} activity items parsed` : "activity hidden on anonymous view", fields: ctFields });

  /* external — real links harvested from the page + canonical */
  const ext: { label: string; href: string; conf: number }[] = [];
  const seen = new Set<string>();
  const classify = (href: string): { label: string; conf: number } | null => {
    if (/github\.com\//.test(href) && !/linkedin/.test(href)) return { label: "GitHub", conf: 0.95 };
    if (/leetcode\.com\//.test(href)) return { label: "LeetCode", conf: 0.92 };
    if (/kaggle\.com\//.test(href)) return { label: "Kaggle", conf: 0.9 };
    if (/stackoverflow\.com\/users\//.test(href)) return { label: "Stack Overflow", conf: 0.9 };
    if (/scholar\.google\.com|researchgate\.net|orcid\.org/.test(href)) return { label: "Research Profile", conf: 0.88 };
    if (/x\.com\/|twitter\.com\//.test(href)) return { label: "X / Twitter", conf: 0.9 };
    if (/medium\.com|dev\.to|hashnode/.test(href)) return { label: "Blog", conf: 0.85 };
    if (/youtube\.com|youtu\.be/.test(href)) return { label: "YouTube", conf: 0.85 };
    if (/^https?:\/\//.test(href) && !/linkedin\.com|licdn\.com|google\./.test(href)) return { label: "Personal Site", conf: 0.8 };
    return null;
  };
  for (const l of h.externalLinks) {
    const c = classify(l.href);
    if (c && !seen.has(c.label)) {
      seen.add(c.label);
      ext.push({ label: c.label, href: l.href, conf: c.conf });
    }
  }
  const extFields: Field[] = ext.map((e) => found(e.label, "link", e.href, `${h.via} → external link on profile`, e.conf));
  const wanted = ["GitHub", "LeetCode", "Portfolio", "Personal Site", "Kaggle", "Stack Overflow", "Research Profile"];
  for (const w of wanted) {
    if (!ext.some((e) => e.label === w)) {
      extFields.push(missingField(w, S("a[data-contact-info]"), `No ${w} link present in the anonymous response.`));
    }
  }
  mods.push({ id: "external", name: "External Profiles", icon: "orbit", summary: `${ext.length} real links harvested from page`, fields: extFields });

  return mods;
}

/* ------------------------------------------------------------------ */
/*  GitHub — api.github.com REST v3 (real, unauthenticated, CORS)      */
/* ------------------------------------------------------------------ */

function ghField(label: string, kind: Field["kind"], value: string | string[], sel: string, conf: number): Field {
  const f = found(label, kind, value, `api.github.com → ${sel}`, conf);
  return f;
}

async function extractGithub(handle: string, parent: AbortSignal | undefined, log: LogSink): Promise<SourceResult> {
  const traces: Trace[] = [];
  const fail = (error: string): SourceResult => ({
    id: "github", label: "GitHub", status: "failed", handle, url: `https://github.com/${handle}`,
    modules: [], traces, stats: { found: 0, derived: 0, missing: 0, auth: 0, error: 0 }, error,
  });

  const getJson = async (path: string): Promise<any> => {
    const t0 = performance.now();
    const url = `https://api.github.com${path}`;
    log(`GET ${url.replace("https://api.github.com", "api.github.com")} …`, "dim");
    try {
      const res = await fetchWithTimeout(url, parent, 15000, { headers: { Accept: "application/vnd.github+json" } });
      const text = await res.text();
      traces.push({ via: "github REST v3", url, status: res.status, bytes: text.length, ms: Math.round(performance.now() - t0), ok: res.ok });
      if (res.status === 404) {
        log(`✗ 404 — no such GitHub resource: ${path}`, "err");
        throw new Error(`GitHub returned 404 for ${path}`);
      }
      if (res.status === 403) {
        log("✗ 403 — GitHub API rate limit hit (60/hr unauthenticated)", "err");
        throw new Error("GitHub API rate limit reached. Wait a few minutes or add a token in a later phase.");
      }
      if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
      log(`✓ ${res.status} · ${(text.length / 1024).toFixed(1)} KB · ${Math.round(performance.now() - t0)} ms`, "ok");
      return JSON.parse(text);
    } catch (e) {
      if ((e as Error).name === "AbortError" && parent?.aborted) throw e;
      if (traces[traces.length - 1]?.status === undefined) traces.push({ via: "github REST v3", url, status: "ERR", bytes: 0, ms: Math.round(performance.now() - t0), ok: false });
      log(`✗ ${(e as Error).message ?? e}`, "err");
      throw e;
    }
  };

  try {
    const user = await getJson(`/users/${encodeURIComponent(handle)}`);
    const reposRaw: any[] = await getJson(`/users/${encodeURIComponent(handle)}/repos?per_page=100&sort=updated`);
    const repos = (reposRaw || []).filter((r) => !r.fork);

    const events: any[] = await (async () => {
      try {
        return (await getJson(`/users/${encodeURIComponent(handle)}/events/public?per_page=60`)) as any[];
      } catch {
        return [];
      }
    })();

    const stars = repos.reduce((a, r) => a + (r.stargazers_count || 0), 0);
    const forks = repos.reduce((a, r) => a + (r.forks_count || 0), 0);
    const langBytes: Record<string, number> = {};
    for (const r of repos) if (r.language) langBytes[r.language] = (langBytes[r.language] || 0) + (r.size || 1);
    const totalBytes = Object.values(langBytes).reduce((a, b) => a + b, 0) || 1;
    const langs = Object.entries(langBytes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([l, b]) => ({ l, pct: Math.round((b / totalBytes) * 100) }));
    const topics = [...new Set(repos.flatMap((r) => r.topics ?? []))].slice(0, 18);
    const topRepos = [...repos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0)).slice(0, 5);
    const lastPush = repos.map((r) => r.pushed_at).filter(Boolean).sort().reverse()[0] ?? null;
    const daysBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

    const identity: Field[] = [];
    identity.push(ghField("Full Name", "text", user.name || handle, ".name", 0.99));
    identity.push(found("Profile URL", "link", user.html_url, ".html_url", 0.99));
    if (user.bio) identity.push(ghField("Bio", "text", user.bio, ".bio", 0.95));
    if (user.company) identity.push(ghField("Company", "text", String(user.company).replace(/^@/, ""), ".company", 0.9));
    if (user.location) identity.push(ghField("Location", "text", user.location, ".location", 0.9));
    if (user.blog) {
      const blog = /^https?:\/\//.test(user.blog) ? user.blog : `https://${user.blog}`;
      identity.push(found("Portfolio / Website", "link", blog, ".blog", 0.92));
    }
    if (user.twitter_username) identity.push(found("X / Twitter", "link", `https://x.com/${user.twitter_username}`, ".twitter_username", 0.92));
    identity.push(ghField("Followers", "text", `${Number(user.followers ?? 0).toLocaleString()} followers · ${Number(user.following ?? 0).toLocaleString()} following`, ".followers", 0.97));
    const joined = user.created_at ? new Date(user.created_at) : null;
    if (joined) identity.push(ghField("Member Since", "text", joined.toLocaleDateString(undefined, { month: "long", year: "numeric" }), ".created_at", 0.95));

    const stack: Field[] = [
      ghField("Public Repositories", "text", `${repos.length} source repos · ${stars.toLocaleString()} ★ · ${forks} forks`, ".public_repos (derived)", 0.95),
    ];
    if (langs.length) {
      const barsField: Field = {
        label: "Language Stack (repo-weighted)", kind: "bars", status: "found", conf: 0.9,
        source: "repos[].language + size (derived)",
        bars: langs.slice(0, 6).map((x) => ({ label: x.l, pct: x.pct, detail: `${x.pct}% of source bytes` })),
      };
      stack.push(barsField);
      stack.push(ghField("Languages", "chips", langs.map((x) => x.l), "repos[].language", 0.9));
    } else {
      stack.push(missingField("Languages", "repos[].language", "No source repos with detected languages."));
    }
    if (topics.length) stack.push(ghField("Repo Topics", "chips", topics as string[], "repos[].topics", 0.85));

    const activity: Field[] = [];
    if (lastPush) {
      const days = daysBetween(lastPush, new Date().toISOString());
      activity.push(ghField("Last Push", "text", `${new Date(lastPush).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${days} day${days > 1 ? "s" : ""} ago`, "repos[].pushed_at (max)", 0.92));
    }
    if (events.length) {
      const push = events.filter((e) => e.type === "PushEvent").length;
      const pr = events.filter((e) => e.type === "PullRequestEvent").length;
      const issues = events.filter((e) => e.type === "IssuesEvent" || e.type === "IssueCommentEvent").length;
      const starEv = events.filter((e) => e.type === "WatchEvent").length;
      const first = new Date(events[events.length - 1].created_at);
      const spanDays = daysBetween(first.toISOString(), new Date().toISOString());
      activity.push(
        found("Public Events (last 60)", "lines", [
          `${push} pushes · ${pr} pull requests · ${issues} issue events · ${starEv} stars given`,
          `Cadence: ~${Math.round((events.length / spanDays) * 7)} events/week across the fetched window`,
        ], "users/{u}/events/public (derived)", 0.88),
      );
    } else {
      activity.push(missingField("Public Events", "users/{u}/events/public", "Events endpoint returned nothing for this user."));
    }

    const modules: ModuleData[] = [
      { id: "identity", name: "Identity & Basics", icon: "fingerprint", summary: "live from users/{handle}", fields: identity },
      { id: "skills", name: "Technical Stack", icon: "chip", summary: `${langs.length} languages · ${topics.length} topics`, fields: stack },
      { id: "projects", name: "Repositories → Projects", icon: "rocket", summary: `top ${topRepos.length} of ${repos.length} by stars`, fields: [],
        entries: topRepos.map((r) => ({
          title: r.name,
          subtitle: [r.language, r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : null].filter(Boolean).join(" · ") || undefined,
          meta: `${(r.stargazers_count || 0).toLocaleString()} ★ · ${(r.forks_count || 0)} forks`,
          fields: [
            ...(r.description ? [found("Description", "text", r.description, "repos[].description", 0.95)] : []),
            found("Repository URL", "link", r.html_url, "repos[].html_url", 0.99),
            ...(r.homepage ? [found("Live URL", "link", r.homepage, "repos[].homepage", 0.9)] : []),
            found("Tech", "chips", [r.language, ...(r.topics ?? []).slice(0, 5)].filter(Boolean), "repos[].language + topics", 0.85),
            found("Last Push", "text", r.pushed_at ? new Date(r.pushed_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—", "repos[].pushed_at", 0.9),
          ],
        })),
      },
      { id: "content", name: "Activity", icon: "pen", summary: events.length ? `${events.length} public events fetched` : "no event data", fields: activity },
    ];

    return {
      id: "github", label: "GitHub", status: "ok", handle, url: user.html_url, avatar: user.avatar_url,
      modules, traces, stats: tally(modules),
    };
  } catch (e) {
    if (parent?.aborted) throw e;
    return fail((e as Error).message || "GitHub extraction failed");
  }
}

/* ------------------------------------------------------------------ */
/*  LeetCode — real stats, triple fallback                             */
/* ------------------------------------------------------------------ */

interface LcStats {
  solved: number; easy: number; medium: number; hard: number;
  ranking: number; reputation: number; acceptance: number | null;
}

async function fetchLcStats(handle: string, parent: AbortSignal | undefined, log: LogSink): Promise<{ s: LcStats; trace: Trace } | null> {
  const attempts: { via: string; url: string; pick: (j: any) => LcStats }[] = [
    {
      via: "leetcode-stats API", url: `https://leetcode-stats-api.herokuapp.com/${encodeURIComponent(handle)}`,
      pick: (j) => ({ solved: j.totalSolved ?? 0, easy: j.easySolved ?? 0, medium: j.mediumSolved ?? 0, hard: j.hardSolved ?? 0, ranking: j.ranking ?? 0, reputation: j.reputation ?? 0, acceptance: j.acceptanceRate ?? null }),
    },
    {
      via: "leecode-api wrapper", url: `https://leecode-api.vercel.app/api/${encodeURIComponent(handle)}`,
      pick: (j) => ({ solved: j.totalSolved ?? 0, easy: j.easySolved ?? 0, medium: j.mediumSolved ?? 0, hard: j.hardSolved ?? 0, ranking: j.ranking ?? 0, reputation: j.reputation ?? 0, acceptance: null }),
    },
  ];
  for (const a of attempts) {
    const t0 = performance.now();
    try {
      log(`GET ${a.url.replace("https://", "")} …`, "dim");
      const res = await fetchWithTimeout(a.url, parent, 14000);
      const txt = await res.text();
      const ms = Math.round(performance.now() - t0);
      if (!res.ok) {
        log(`✗ ${a.via} → HTTP ${res.status} · ${ms} ms`, "warn");
        continue;
      }
      const j = JSON.parse(txt);
      if (typeof j !== "object" || j === null || (j.status === "error")) {
        log(`✗ ${a.via} → no record for “${handle}”`, "warn");
        continue;
      }
      log(`✓ ${a.via} → 200 · ${ms} ms`, "ok");
      return { s: a.pick(j), trace: { via: a.via, url: a.url, status: 200, bytes: txt.length, ms, ok: true } };
    } catch (e) {
      if (parent?.aborted) throw e;
      log(`✗ ${a.via} → ${(e as Error).name} · ${Math.round(performance.now() - t0)} ms`, "warn");
    }
  }
  return null;
}

async function extractLeetcode(handle: string, parent: AbortSignal | undefined, log: LogSink): Promise<SourceResult> {
  const traces: Trace[] = [];
  const variants = [handle, handle.includes("-") ? handle.replace(/-/g, "_") : null].filter(Boolean) as string[];
  let got: { s: LcStats; trace: Trace; used: string } | null = null;

  for (const v of variants) {
    const r = await fetchLcStats(v, parent, log);
    if (r) {
      got = { ...r, used: v };
      if (r.trace) traces.push(r.trace);
      break;
    }
  }

  if (!got) {
    return {
      id: "leetcode", label: "LeetCode", status: "failed", handle,
      url: `https://leetcode.com/u/${handle}/`, modules: [], traces,
      stats: { found: 0, derived: 0, missing: 0, auth: 0, error: 0 },
      error: `No public stats found for “${handle}” (also tried variants). Either the handle is different on LeetCode, the profile is private, or both stats APIs are down.`,
    };
  }

  const s = got.s;
  const src = `${got.trace.via} → matchedUser.submitStats`;
  const max = Math.max(s.easy, s.medium, s.hard, 1);
  const solved = s.solved || s.easy + s.medium + s.hard;
  const mods: ModuleData[] = [{
    id: "achievements", name: "Problem-Solving Stats", icon: "trophy",
    summary: `${solved} solved · rank #${s.ranking.toLocaleString()}`,
    fields: [
      found("Profile URL", "link", `https://leetcode.com/u/${got.used}/`, "constructed handle URL", 0.95),
      found("Total Solved", "text", String(solved), src, 0.95),
      {
        label: "Solved by Difficulty", kind: "bars", status: "found", conf: 0.92, source: src,
        bars: [
          { label: "Easy", pct: (s.easy / max) * 100, detail: String(s.easy) },
          { label: "Medium", pct: (s.medium / max) * 100, detail: String(s.medium) },
          { label: "Hard", pct: (s.hard / max) * 100, detail: String(s.hard) },
        ],
      },
      found("Global Ranking", "text", `#${s.ranking.toLocaleString()}`, src, 0.9),
      ...(s.reputation ? [found("Reputation", "text", s.reputation.toLocaleString(), src, 0.9)] : []),
      ...(s.acceptance != null ? [found("Acceptance Rate", "text", `${Math.round(s.acceptance * 1000) / 10}%`, src, 0.88)] : []),
    ],
  }];

  return {
    id: "leetcode", label: "LeetCode", status: "ok", handle: got.used,
    url: `https://leetcode.com/u/${got.used}/`, modules: mods, traces, stats: tally(mods),
  };
}

/* ------------------------------------------------------------------ */
/*  LinkedIn extraction orchestrator (jina → relays → merge)           */
/* ------------------------------------------------------------------ */

async function extractLinkedIn(slug: string, parent: AbortSignal | undefined, log: LogSink, pastedText?: string): Promise<SourceResult> {
  const url = `https://www.linkedin.com/in/${slug}/`;
  const traces: Trace[] = [];
  let harvest: LiHarvest | null = null;

  if (pastedText && pastedText.trim().length > 60) {
    log(`using operator-pasted profile text (${(pastedText.length / 1024).toFixed(1)} KB) — parsing locally`, "info");
    traces.push({ via: "operator paste", url: "clipboard → local DOMParser", status: 200, bytes: pastedText.length, ms: 0, ok: true });
    harvest = pastedText.trim().startsWith("<") ? parsePublicHtml(pastedText, slug) : parseJinaMarkdown({ title: "", content: pastedText, url }, slug);
    harvest.via = "operator paste";
  } else {
    // 1) Jina Reader — rendered page as markdown
    const j = await fetchJina(url, parent, log);
    traces.push(j.trace);
    if (j.doc.content.length > 200) harvest = parseJinaMarkdown(j.doc, slug);

    // 2) raw HTML via relays — og/meta/JSON-LD + SSR sections
    const raw = await fetchText(url, parent, log);
    if (raw && raw.html) {
      traces.push(...raw.traces);
      const hh = parsePublicHtml(raw.html, slug);
      if (harvest) {
        // merge: fill gaps
        harvest.name ??= hh.name;
        harvest.headline ??= hh.headline;
        harvest.location ??= hh.location;
        harvest.photo ??= hh.photo;
        harvest.aboutMeta ??= hh.aboutMeta;
        if (!harvest.about.length && hh.about.length) harvest.about = hh.about;
        if (!harvest.externalLinks.length && hh.externalLinks.length) harvest.externalLinks = hh.externalLinks;
        if (harvest.wall && !hh.wall) harvest.wall = false;
      } else {
        harvest = hh;
      }
    } else if (raw) {
      traces.push(...raw.traces);
    }
  }

  if (!harvest || (!harvest.name && !harvest.headline && harvest.about.length === 0)) {
    const wallGuess = true;
    const mods = buildLinkedInModules(emptyHarvest("none"), slug, url);
    for (const m of mods) {
      m.summary = "no anonymous response received";
    }
    return {
      id: "linkedin", label: "LinkedIn", status: "failed", handle: slug, url, modules: mods, traces,
      stats: tally(mods),
      error: wallGuess
        ? "Every relay and the reader failed or returned LinkedIn's authwall. The public shell for this slug was not retrievable from this network — paste the profile text below the inputs (or run maxun-core with a session cookie) to get full fields."
        : "Could not retrieve the LinkedIn page.",
    };
  }

  if (harvest.wall) log("⚠ authwall detected — anonymous response is limited; session-backed fetch (maxun-core) required for locked fields", "warn");
  else log(`✓ public profile shell parsed via ${harvest.via}`, "ok");

  const mods = buildLinkedInModules(harvest, slug, url);
  const stats = tally(mods);
  return {
    id: "linkedin", label: "LinkedIn",
    status: harvest.wall ? "partial" : "ok",
    handle: slug, url, avatar: harvest.photo ?? undefined, modules: mods, traces, stats,
    error: harvest.wall ? "Authwall-limited response: fields behind login are flagged AUTH — real, not guessed." : undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  stats + top-level extraction                                       */
/* ------------------------------------------------------------------ */

function tally(modules: ModuleData[]): SourceResult["stats"] {
  const all = modules.flatMap((m) => [...m.fields, ...(m.entries ?? []).flatMap((e) => e.fields)]);
  const c = (s: FieldStatus) => all.filter((f) => f.status === s).length;
  return { found: c("found"), derived: c("derived"), missing: c("missing"), auth: c("auth"), error: c("error") };
}

export interface ExtractInput {
  linkedin?: string;
  github?: string;
  leetcode?: string;
}

export async function extract(
  inp: ExtractInput,
  log: LogSink,
  parent: AbortSignal,
  pastedText?: string,
  onSource?: SourceProgress,
): Promise<Extraction> {
  const t0 = performance.now();
  const liSlug = inp.linkedin ? parseSlug(inp.linkedin) : null;
  const gh = inp.github ? normalizeGithub(inp.github) : null;
  const lc = inp.leetcode ? parseLeetcode(inp.leetcode) : null;
  const results: SourceResult[] = [];

  if (!liSlug && !gh && !lc) throw new Error("Provide at least one target: a LinkedIn URL/slug, a GitHub handle, or a LeetCode username.");
  log(`target lock → ${[liSlug && `linkedin:${liSlug}`, gh && `github:${gh}`, lc && `leetcode:${lc}`].filter(Boolean).join(" · ")}`, "info");

  if (liSlug) {
    onSource?.("linkedin", "running", []);
    log("── LinkedIn · public shell extraction ──────────────", "dim");
    const r = await extractLinkedIn(liSlug, childSignal(parent), log, pastedText);
    results.push(r);
    onSource?.("linkedin", r.status === "failed" ? "failed" : "done", r.modules);
    await sleep(150);
  }
  if (gh) {
    onSource?.("github", "running", []);
    log("── GitHub · REST v3 (unauthenticated, live) ────────", "dim");
    const r = await extractGithub(gh, childSignal(parent), log);
    results.push(r);
    onSource?.("github", r.status === "failed" ? "failed" : "done", r.modules);
    await sleep(150);
  }
  if (lc) {
    onSource?.("leetcode", "running", []);
    log("── LeetCode · public stats ─────────────────────────", "dim");
    const r = await extractLeetcode(lc, childSignal(parent), log);
    results.push(r);
    onSource?.("leetcode", r.status === "failed" ? "failed" : "done", r.modules);
  }

  return {
    targets: { linkedin: liSlug, github: gh, leetcode: lc },
    results,
    ms: Math.round(performance.now() - t0),
    at: new Date().toISOString(),
    engine: ENGINE,
  };
}

export function toExportPayload(ex: Extraction) {
  const fieldOut = (f: Field) => ({
    label: f.label, status: f.status, conf: f.conf, source: f.source,
    ...(f.value !== undefined ? { value: f.value } : {}),
    ...(f.values !== undefined ? { values: f.values } : {}),
    ...(f.bars !== undefined ? { bars: f.bars } : {}),
    ...(f.note !== undefined ? { note: f.note } : {}),
  });
  return {
    schema: "sieve.live-extraction/v2",
    engine: ex.engine,
    extracted_at: ex.at,
    elapsed_ms: ex.ms,
    targets: ex.targets,
    sources: ex.results.map((r) => ({
      id: r.id, label: r.label, status: r.status, handle: r.handle, url: r.url,
      stats: r.stats, traces: r.traces, error: r.error,
      modules: r.modules.map((m) => ({
        id: m.id, name: m.name, summary: m.summary, fields: m.fields.map(fieldOut),
        ...(m.entries ? { entries: m.entries.map((e) => ({ title: e.title, subtitle: e.subtitle, meta: e.meta, fields: e.fields.map(fieldOut) })) } : {}),
      })),
    })),
    embedding_hint: {
      strategy: "module-scoped · status-weighted (found/derived only)",
      model: "text-embedding-3-large",
      eligible_fields: ex.results.reduce((a, r) => a + r.stats.found + r.stats.derived, 0),
    },
  };
}
