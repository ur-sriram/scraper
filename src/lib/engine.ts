/* ================================================================== */
/*  SIEVE live extraction engine v2 — real HTTP, real parsing.         */
/*  LinkedIn: public page fetched via CORS relays, parsed in-browser.  */
/*  GitHub:   official REST API (CORS-enabled, no key, 60 req/h).      */
/*  LeetCode: public stats APIs with GraphQL-over-relay fallback.      */
/* ================================================================== */

export type SourceId = "linkedin" | "github" | "leetcode";
export type FieldStatus = "found" | "derived" | "missing" | "auth" | "error";
export type FieldKind = "text" | "link" | "chips" | "lines" | "bars";
export type Tone = "info" | "ok" | "warn" | "dim" | "err";

export interface Field {
  label: string;
  kind: FieldKind;
  value?: string;
  values?: string[];
  bars?: { label: string; pct: number; detail: string }[];
  status: FieldStatus;
  source: string; // real origin: URL, API path or DOM selector
  conf: number; // parse confidence 0..1
  note?: string;
}

export interface ModuleEntry {
  title: string;
  subtitle?: string;
  meta?: string;
  fields: Field[];
}

export interface HttpTrace {
  url: string;
  via: string;
  status: number | string;
  ok: boolean;
  bytes: number;
  ms: number;
}

export interface SourceModule {
  id: string;
  name: string;
  icon: string;
  summary: string;
  fields: Field[];
  entries?: ModuleEntry[];
}

export interface SourceResult {
  id: SourceId;
  label: string;
  handle: string;
  status: "ok" | "partial" | "failed" | "off";
  headline: string;
  avatar?: string;
  url?: string;
  modules: SourceModule[];
  traces: HttpTrace[];
  error?: string;
  stats: { found: number; derived: number; missing: number; auth: number; error: number };
}

export interface Targets {
  linkedin: string;
  github: string;
  leetcode: string;
}

export interface Extraction {
  targets: Targets;
  results: SourceResult[];
  startedAt: string;
  ms: number;
}

export interface Hooks {
  log: (text: string, tone?: Tone) => void;
  source: (id: SourceId, status: "running" | "ok" | "partial" | "failed") => void;
  module: (key: string, status: "active" | "done") => void;
  shouldAbort: () => boolean;
}

/* ------------------------------------------------------------------ */
/*  extraction plan (drives the pipeline panel)                        */
/* ------------------------------------------------------------------ */

export const SOURCE_PLAN: {
  id: SourceId;
  label: string;
  icon: string;
  endpoint: string;
  modules: { key: string; name: string; icon: string }[];
}[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: "linkedin",
    endpoint: "linkedin.com/in/<slug> via CORS relay",
    modules: [
      { key: "li-identity", name: "Identity & Photo", icon: "fingerprint" },
      { key: "li-about", name: "About / Work / Education (public meta)", icon: "pen" },
      { key: "li-external", name: "Canonical & Network Trace", icon: "link" },
      { key: "li-session", name: "Auth-gated spec fields (Phase 01.5)", icon: "lock" },
    ],
  },
  {
    id: "github",
    label: "GitHub",
    icon: "github",
    endpoint: "api.github.com REST v3",
    modules: [
      { key: "gh-identity", name: "Profile", icon: "user" },
      { key: "gh-projects", name: "Repositories → Projects", icon: "rocket" },
      { key: "gh-skills", name: "Language Stack & Topics", icon: "chip" },
      { key: "gh-activity", name: "Recent Activity", icon: "pulse" },
    ],
  },
  {
    id: "leetcode",
    label: "LeetCode",
    icon: "leetcode",
    endpoint: "public stats API / GraphQL",
    modules: [{ key: "lc-stats", name: "Solving Stats & Rank", icon: "trophy" }],
  },
];

/* Phase-01 spec fields LinkedIn locks behind login */
export const AUTH_GATED = [
  "Full experience entries (descriptions, dates, durations)",
  "Skills list & endorsements",
  "Open to Work signals & preferences",
  "Education details (grades, coursework, activities)",
  "Certifications & credential IDs",
  "Projects section entries",
  "Honors, awards & test scores",
  "Recommendations received / given",
  "Volunteering & organizations",
  "Posts, articles & activity feed",
  "Contact info (email, phone, IM)",
  "Connections count & network graph",
];

/* ------------------------------------------------------------------ */
/*  low-level network                                                  */
/* ------------------------------------------------------------------ */

async function fetchTimed(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const RELAYS = [
  { name: "allorigins", wrap: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { name: "corsproxy.io", wrap: (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}` },
  { name: "codetabs", wrap: (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
];

async function relayFetch(
  target: string,
  hooks: Hooks,
  expect: "html" | "json",
): Promise<{ text: string; trace: HttpTrace }> {
  const traces: HttpTrace[] = [];
  for (const r of RELAYS) {
    const t0 = performance.now();
    hooks.log(`→ relay ${r.name} · GET ${target.length > 72 ? target.slice(0, 72) + "…" : target}`, "dim");
    try {
      const res = await fetchTimed(r.wrap(target), 12000);
      const text = await res.text();
      const trace: HttpTrace = {
        url: target,
        via: r.name,
        status: res.status,
        ok: res.ok,
        bytes: text.length,
        ms: Math.round(performance.now() - t0),
      };
      traces.push(trace);
      const looksHtml = /<!doctype html|<html[\s>]/i.test(text.slice(0, 400));
      const looksJson = expect === "json" && text.trim().startsWith("{");
      if (res.ok && (expect === "json" ? looksJson : looksHtml)) {
        hooks.log(`✓ ${r.name} · ${res.status} · ${(text.length / 1024).toFixed(1)} KB · ${trace.ms} ms`, "ok");
        return { text, trace };
      }
      hooks.log(`✕ ${r.name} rejected payload (status ${res.status}, ${looksHtml ? "html" : "non-html"} body)`, "warn");
    } catch (e) {
      traces.push({ url: target, via: r.name, status: "timeout/err", ok: false, bytes: 0, ms: Math.round(performance.now() - t0) });
      hooks.log(`✕ ${r.name} failed — ${(e as Error).name === "AbortError" ? "12s timeout" : "network error"}`, "warn");
    }
  }
  const err = new Error(`all ${RELAYS.length} relays failed for ${target}`) as Error & { traces?: HttpTrace[] };
  err.traces = traces;
  throw err;
}

/* ------------------------------------------------------------------ */
/*  handle parsing                                                     */
/* ------------------------------------------------------------------ */

export function parseLinkedinSlug(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = raw.match(/linkedin\.com\/in\/([A-Za-z0-9\-_%]+)\/?/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9\-_%]{3,100}$/.test(raw)) return raw;
  return null;
}

export function parseGithubHandle(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = raw.match(/github\.com\/([A-Za-z0-9-]+)\/?$/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(raw)) return raw;
  return null;
}

export function parseLeetcodeHandle(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = raw.match(/leetcode\.com\/(?:u\/)?([A-Za-z0-9\-_]+)\/?/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9\-_]{3,60}$/.test(raw)) return raw;
  return null;
}

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

const fmtBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`);

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return "today";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const f = (
  label: string,
  kind: FieldKind,
  status: FieldStatus,
  source: string,
  conf: number,
  extra: Partial<Field> = {},
): Field => ({ label, kind, status, source, conf, ...extra });

function countStats(modules: SourceModule[]): SourceResult["stats"] {
  const s = { found: 0, derived: 0, missing: 0, auth: 0, error: 0 };
  const bump = (st: FieldStatus) => (s[st] += 1);
  for (const m of modules) {
    m.fields.forEach((r) => bump(r.status));
    (m.entries ?? []).forEach((e) => e.fields.forEach((r) => bump(r.status)));
  }
  return s;
}

/* ================================================================== */
/*  LINKEDIN — real public-page fetch + parse                          */
/* ================================================================== */

async function extractLinkedin(slug: string, hooks: Hooks): Promise<SourceResult> {
  const url = `https://www.linkedin.com/in/${slug}/`;
  const traces: HttpTrace[] = [];
  let html = "";
  let trace: HttpTrace | null = null;

  hooks.module("li-identity", "active");
  hooks.log(`linkedin/${slug} — resolving public profile page`, "info");
  try {
    const got = await relayFetch(url, hooks, "html");
    html = got.text;
    trace = got.trace;
    traces.push(got.trace);
  } catch (e) {
    const t = (e as { traces?: HttpTrace[] }).traces ?? [];
    traces.push(...t);
    hooks.source("linkedin", "failed");
    return {
      id: "linkedin",
      label: "LinkedIn",
      handle: slug,
      status: "failed",
      headline: "Unreachable from this browser",
      url,
      modules: [],
      traces,
      error:
        "Every public CORS relay was rejected or timed out. LinkedIn aggressively blocks anonymous datacenter traffic — the production path is maxun-core (headless Chromium + residential proxy + your session cookie), which bypasses relays entirely.",
      stats: { found: 0, derived: 0, missing: 0, auth: AUTH_GATED.length, error: 0 },
    };
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const title = doc.querySelector("title")?.textContent?.trim() ?? "";
  const desc = doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "";
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? url;

  const authwall =
    /sign up \| linkedin|log in, sign up/i.test(title) ||
    html.includes('"isAuthWallPage":true') ||
    /id=["']?authwall/i.test(html);

  if (authwall) hooks.log("⚠ authwall detected — LinkedIn served the sign-in gate; parsing public meta only", "warn");
  else hooks.log(`✓ public profile served — <title> + meta tags parseable (${fmtBytes(html.length)})`, "ok");

  /* identity from <title>: "Name - Headline | Location | LinkedIn" */
  let name: string | null = null;
  let headline: string | null = null;
  let location: string | null = null;
  if (!authwall) {
    const t = title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
    const dash = t.indexOf(" - ");
    if (dash > 0) {
      name = t.slice(0, dash).trim();
      const parts = t.slice(dash + 3).split(" | ").map((s) => s.trim()).filter(Boolean);
      headline = parts[0] ?? null;
      location = parts.slice(1).join(", ") || null;
    } else if (t) name = t;
  }

  /* meta-description segments: "… About: <text> Experience: <text> Education: <text> …" */
  const grab = (start: string, ends: string[]): string | null => {
    const i = desc.indexOf(start);
    if (i < 0) return null;
    let j = desc.length;
    for (const e of ends) {
      const k = desc.indexOf(e, i + start.length);
      if (k > -1 && k < j) j = k;
    }
    const out = desc.slice(i + start.length, j).replace(/\s+/g, " ").replace(/…\s*more\s*$/i, "").trim();
    return out || null;
  };
  const aboutSeg = grab("About: ", ["Experience: ", "Education: ", "Skills: ", "View "]);
  const expSeg = grab("Experience: ", ["Education: ", "Skills: ", "View ", "… more"]);
  const eduSeg = grab("Education: ", ["Skills: ", "View ", "… more"]);

  const jobsMatch = desc.match(/has (\d+) jobs? listed/i);
  const connMatch = desc.match(/([\d,]+\+?)\s*(connections|followers)/i);

  const photoOk = ogImage.includes("licdn.com") && !/ghost|generic/i.test(ogImage);
  const srcTitle = `GET /in/${slug} → <title>`;
  const srcMeta = `GET /in/${slug} → meta[name=description]`;
  const authNote = "authwall served — requires authenticated session (maxun-core Phase 01.5)";

  const identity: SourceModule = {
    id: "li-identity",
    name: "Identity & Photo",
    icon: "fingerprint",
    summary: authwall ? "Authwall — public meta only" : `Parsed from live HTML (${fmtBytes(html.length)})`,
    fields: [
      name
        ? f("Full Name", "text", "found", srcTitle, 0.95, { value: name })
        : f("Full Name", "text", "auth", srcTitle, 0, { note: authNote }),
      headline
        ? f("Headline", "text", "found", srcTitle, 0.92, { value: headline })
        : f("Headline", "text", "auth", srcTitle, 0, { note: authNote }),
      location
        ? f("Location", "text", "found", srcTitle, 0.9, { value: location })
        : f("Location", "text", "auth", srcTitle, 0, { note: authNote }),
      f(
        "Profile Photo",
        "link",
        photoOk ? "found" : "missing",
        `GET /in/${slug} → meta[property=og:image]`,
        photoOk ? 0.9 : 0,
        photoOk ? { value: ogImage } : { note: "LinkedIn served a generic ghost avatar, not the real photo" },
      ),
      f("Profile URL", "link", "found", `GET /in/${slug} → link[rel=canonical]`, 0.99, { value: canonical }),
      f(
        "Page Served",
        "text",
        authwall ? "error" : "found",
        `relay ${trace?.via ?? "—"} · HTTP ${trace?.status ?? "—"}`,
        authwall ? 0.6 : 0.99,
        { value: authwall ? "Authwall (sign-in gate)" : "Full public profile", note: `${fmtBytes(html.length)} received in ${trace?.ms ?? 0} ms` },
      ),
    ],
  };
  hooks.module("li-identity", "done");
  hooks.log(
    identity.fields.filter((r) => r.status === "found").length
      ? `✓ identity — ${identity.fields.filter((r) => r.status === "found").length}/6 fields from live DOM`
      : "⚠ identity — 0 public fields (authwall)",
    authwall ? "warn" : "ok",
  );

  hooks.module("li-about", "active");
  const about: SourceModule = {
    id: "li-about",
    name: "About / Work / Education (public meta)",
    icon: "pen",
    summary: "Everything LinkedIn exposes without login — real segments from the meta description",
    fields: [
      aboutSeg
        ? f("About (excerpt)", "text", "found", `${srcMeta} → "About:" segment`, 0.82, { value: aboutSeg })
        : f("About (excerpt)", "text", aboutSeg === null && authwall ? "auth" : "missing", srcMeta, 0, {
            note: authwall ? authNote : "no About: segment in public meta",
          }),
      expSeg
        ? f("Experience (excerpt)", "text", "found", `${srcMeta} → "Experience:" segment`, 0.74, { value: expSeg })
        : f("Experience (excerpt)", "text", authwall ? "auth" : "missing", srcMeta, 0, { note: authwall ? authNote : "no Experience: segment in public meta" }),
      eduSeg
        ? f("Education (excerpt)", "text", "found", `${srcMeta} → "Education:" segment`, 0.74, { value: eduSeg })
        : f("Education (excerpt)", "text", authwall ? "auth" : "missing", srcMeta, 0, { note: authwall ? authNote : "no Education: segment in public meta" }),
      jobsMatch
        ? f("Roles Listed on Profile", "text", "derived", `${srcMeta} → /has (\\d+) jobs listed/`, 0.88, { value: `${jobsMatch[1]} positions` })
        : f("Roles Listed on Profile", "text", "missing", srcMeta, 0, { note: "sentence not present in this meta variant" }),
      connMatch
        ? f("Network Size", "text", "derived", `${srcMeta} → connection/follower count`, 0.8, { value: `${connMatch[1]} ${connMatch[2]}` })
        : f("Network Size", "text", "missing", srcMeta, 0, { note: "hidden without login" }),
    ],
  };
  hooks.module("li-about", "done");
  hooks.log(
    `✓ about module — ${about.fields.filter((r) => r.status === "found" || r.status === "derived").length}/5 fields extracted from meta`,
    "ok",
  );

  hooks.module("li-external", "active");
  const sameAs: string[] = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const j = JSON.parse(s.textContent ?? "");
      const items = Array.isArray(j) ? j : [j];
      items.forEach((it) => {
        if (it?.sameAs) sameAs.push(...(Array.isArray(it.sameAs) ? it.sameAs : [it.sameAs]));
      });
    } catch {
      /* not json */
    }
  });
  const external: SourceModule = {
    id: "li-external",
    name: "Canonical & Network Trace",
    icon: "link",
    summary: "Provenance of this extraction",
    fields: [
      f("Canonical URL", "link", "found", "link[rel=canonical]", 0.99, { value: canonical }),
      sameAs.length
        ? f("sameAs Links (JSON-LD)", "lines", "found", 'script[type="application/ld+json"] → sameAs', 0.9, { values: sameAs })
        : f("sameAs Links (JSON-LD)", "lines", "missing", 'script[type="application/ld+json"]', 0, { note: "no structured sameAs block served" }),
      f(
        "Relay Chain",
        "lines",
        "derived",
        "SIEVE relay runner",
        0.99,
        { values: traces.map((t) => `${t.via} → HTTP ${t.status} · ${fmtBytes(t.bytes)} · ${t.ms} ms`) },
      ),
      f("Contact Info (email, IM)", "text", "auth", "section.pv-contact-info (login required)", 0, { note: authNote }),
    ],
  };
  hooks.module("li-external", "done");

  hooks.module("li-session", "active");
  const session: SourceModule = {
    id: "li-session",
    name: "Auth-gated spec fields (Phase 01.5)",
    icon: "lock",
    summary: `${AUTH_GATED.length} fields from your Phase-01 spec that LinkedIn never serves anonymously`,
    fields: AUTH_GATED.map((g) =>
      f(g, "text", "auth", "linkedin.com — behind authwall", 0, {
        note: "extracted by maxun-core with a session cookie + stealth Chromium",
      }),
    ),
  };
  hooks.module("li-session", "done");
  hooks.log(`◌ ${AUTH_GATED.length} spec fields mapped to the authenticated tier (Phase 01.5)`, "dim");

  const modules = [identity, about, external, session];
  const foundCount = countStats(modules).found;
  const failed = false;
  hooks.source("linkedin", failed ? "failed" : authwall ? "partial" : "ok");

  return {
    id: "linkedin",
    label: "LinkedIn",
    handle: slug,
    status: authwall ? "partial" : "ok",
    headline: authwall
      ? "Authwall hit — public meta only"
      : `${foundCount} live fields · public tier`,
    avatar: photoOk ? ogImage : undefined,
    url: canonical,
    modules,
    traces,
    stats: countStats(modules),
  };
}

/* ================================================================== */
/*  GITHUB — official REST API (real, CORS-enabled)                    */
/* ================================================================== */

type GhUser = {
  login: string; name: string | null; bio: string | null; company: string | null;
  location: string | null; blog: string | null; twitter_username: string | null;
  avatar_url: string; html_url: string; followers: number; following: number;
  public_repos: number; public_gists: number; created_at: string; email: string | null;
};
type GhRepo = {
  name: string; full_name: string; description: string | null; language: string | null;
  stargazers_count: number; forks_count: number; open_issues_count: number; fork: boolean;
  html_url: string; homepage: string | null; pushed_at: string; created_at: string;
  license: { spdx_id: string | null } | null; topics?: string[];
};
type GhEvent = {
  type: string; created_at: string;
  repo: { name: string };
  payload?: { ref?: string; commits?: unknown[]; action?: string };
};

async function extractGithub(handle: string, hooks: Hooks): Promise<SourceResult> {
  const traces: HttpTrace[] = [];
  const apiGet = async <T,>(path: string): Promise<T> => {
    const url = `https://api.github.com${path}`;
    const t0 = performance.now();
    hooks.log(`→ GET api.github.com${path}`, "dim");
    const res = await fetchTimed(url, 12000, { headers: { Accept: "application/vnd.github+json" } });
    const text = await res.text();
    traces.push({ url, via: "direct", status: res.status, ok: res.ok, bytes: text.length, ms: Math.round(performance.now() - t0) });
    if (res.status === 404) throw new Error("404: GitHub user not found");
    if (res.status === 403 || res.status === 429) {
      const reset = res.headers.get("x-ratelimit-reset");
      throw new Error(`403: anonymous rate limit exhausted${reset ? ` — resets ${new Date(Number(reset) * 1000).toLocaleTimeString()}` : ""}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remaining = res.headers.get("x-ratelimit-remaining");
    hooks.log(`✓ ${res.status} · ${fmtBytes(text.length)} · ${Math.round(performance.now() - t0)} ms${remaining ? ` · rate-limit remaining ${remaining}` : ""}`, "ok");
    return JSON.parse(text) as T;
  };

  hooks.module("gh-identity", "active");
  let user: GhUser;
  try {
    user = await apiGet<GhUser>(`/users/${handle}`);
  } catch (e) {
    hooks.source("github", "failed");
    hooks.log(`✕ github — ${(e as Error).message}`, "err");
    return {
      id: "github", label: "GitHub", handle, status: "failed",
      headline: (e as Error).message, url: `https://github.com/${handle}`,
      modules: [], traces, error: (e as Error).message,
      stats: { found: 0, derived: 0, missing: 0, auth: 0, error: 1 },
    };
  }

  const remaining = traces[0] ? "see trace" : "";
  void remaining;

  const srcU = `api.github.com/users/${handle}`;
  const identity: SourceModule = {
    id: "gh-identity",
    name: "Profile",
    icon: "user",
    summary: `${user.public_repos} public repos · ${user.followers.toLocaleString()} followers`,
    fields: [
      user.name ? f("Full Name", "text", "found", `${srcU} → .name`, 0.99, { value: user.name }) : f("Full Name", "text", "missing", `${srcU} → .name`, 0, { note: "null — user has not set a display name" }),
      f("Username", "text", "found", `${srcU} → .login`, 0.99, { value: user.login }),
      user.bio ? f("Bio / About", "text", "found", `${srcU} → .bio`, 0.97, { value: user.bio }) : f("Bio / About", "text", "missing", `${srcU} → .bio`, 0, { note: "empty on GitHub" }),
      user.company ? f("Company", "text", "found", `${srcU} → .company`, 0.95, { value: user.company }) : f("Company", "text", "missing", `${srcU} → .company`, 0, { note: "not set" }),
      user.location ? f("Location", "text", "found", `${srcU} → .location`, 0.95, { value: user.location }) : f("Location", "text", "missing", `${srcU} → .location`, 0, { note: "not set" }),
      user.blog ? f("Blog / Website", "link", "found", `${srcU} → .blog`, 0.95, { value: /^https?:/.test(user.blog) ? user.blog : `https://${user.blog}` }) : f("Blog / Website", "link", "missing", `${srcU} → .blog`, 0, { note: "not set" }),
      user.twitter_username ? f("X / Twitter", "link", "found", `${srcU} → .twitter_username`, 0.95, { value: `https://x.com/${user.twitter_username}` }) : f("X / Twitter", "link", "missing", `${srcU} → .twitter_username`, 0, { note: "not linked" }),
      user.email ? f("Public Email", "text", "found", `${srcU} → .email`, 0.95, { value: user.email }) : f("Public Email", "text", "missing", `${srcU} → .email`, 0, { note: "hidden (GitHub default)" }),
      f("Avatar", "link", "found", `${srcU} → .avatar_url`, 0.99, { value: user.avatar_url }),
      f("Followers", "text", "found", `${srcU} → .followers`, 0.99, { value: user.followers.toLocaleString() }),
      f("Following", "text", "found", `${srcU} → .following`, 0.99, { value: user.following.toLocaleString() }),
      f("Public Repos / Gists", "text", "found", `${srcU} → .public_repos/.public_gists`, 0.99, { value: `${user.public_repos} repos · ${user.public_gists} gists` }),
      f("Joined", "text", "derived", `${srcU} → .created_at`, 0.99, { value: `${fmtDate(user.created_at)} · on platform ${relTime(user.created_at)}` }),
      f("Profile URL", "link", "found", `${srcU} → .html_url`, 0.99, { value: user.html_url }),
    ],
  };
  hooks.module("gh-identity", "done");
  hooks.log(`✓ profile — 14 fields from /users/${handle}`, "ok");

  hooks.module("gh-projects", "active");
  let repos: GhRepo[] = [];
  try {
    repos = await apiGet<GhRepo[]>(`/users/${handle}/repos?per_page=100&sort=pushed`);
  } catch (e) {
    hooks.log(`⚠ repos fetch failed — ${(e as Error).message}`, "warn");
  }
  const own = repos.filter((r) => !r.fork);
  const top = [...(own.length ? own : repos)].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 6);
  const srcR = `api.github.com/users/${handle}/repos`;
  const projects: SourceModule = {
    id: "gh-projects",
    name: "Repositories → Projects",
    icon: "rocket",
    summary: top.length
      ? `top ${top.length} of ${own.length} own repos by stars (live API)`
      : "no public repositories returned",
    fields: [],
    entries: top.map((r) => ({
      title: r.name,
      subtitle: `${r.language ?? "no dominant language"} · ★ ${r.stargazers_count.toLocaleString()} · ${r.forks_count} forks`,
      meta: `created ${fmtDate(r.created_at)} · last push ${relTime(r.pushed_at)}`,
      fields: [
        r.description ? f("Description", "text", "found", `${srcR} → [${r.name}].description`, 0.97, { value: r.description }) : f("Description", "text", "missing", `${srcR} → .description`, 0, { note: "repo has no description" }),
        f("Primary Language", "text", r.language ? "found" : "missing", `${srcR} → .language`, 0.95, { value: r.language ?? undefined, note: r.language ? undefined : "GitHub detected no language" }),
        f("Stars / Forks / Open Issues", "text", "found", `${srcR} → .stargazers_count / .forks_count / .open_issues_count`, 0.99, { value: `★ ${r.stargazers_count.toLocaleString()} · ${r.forks_count} forks · ${r.open_issues_count} issues` }),
        f("License", "text", r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? "found" : "missing", `${srcR} → .license.spdx_id`, 0.95, { value: r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : undefined, note: r.license?.spdx_id ? undefined : "no license declared" }),
        r.homepage ? f("Live URL", "link", "found", `${srcR} → .homepage`, 0.9, { value: /^https?:/.test(r.homepage) ? r.homepage : `https://${r.homepage}` }) : f("Live URL", "link", "missing", `${srcR} → .homepage`, 0, { note: "no homepage set" }),
        f("Repository", "link", "found", `${srcR} → .html_url`, 0.99, { value: r.html_url }),
      ],
    })),
  };
  hooks.module("gh-projects", "done");
  hooks.log(`✓ projects — ${top.length} repo cards built from ${repos.length} fetched`, "ok");

  hooks.module("gh-skills", "active");
  const langWeight = new Map<string, number>();
  const langCount = new Map<string, number>();
  (own.length ? own : repos).forEach((r) => {
    if (!r.language) return;
    langWeight.set(r.language, (langWeight.get(r.language) ?? 0) + r.stargazers_count + 1);
    langCount.set(r.language, (langCount.get(r.language) ?? 0) + 1);
  });
  const langs = [...langCount.entries()].sort((a, b) => (langWeight.get(b[0]) ?? 0) - (langWeight.get(a[0]) ?? 0)).slice(0, 8);
  const topics = [...new Map((repos.flatMap((r) => r.topics ?? []).map((t) => [t, 1]) as [string, number][])).keys()].slice(0, 12);
  const starredLangs = [...new Set(top.map((r) => r.language).filter(Boolean))] as string[];
  const skills: SourceModule = {
    id: "gh-skills",
    name: "Language Stack & Topics",
    icon: "chip",
    summary: langs.length ? `${langs.length} languages observed across repos` : "no language signal",
    fields: [
      langs.length
        ? f("Languages (star-weighted)", "chips", "derived", `${srcR} → aggregate .language × .stargazers_count`, 0.85, { values: langs.map(([l, n]) => `${l} · ${n} repo${n > 1 ? "s" : ""}`) })
        : f("Languages (star-weighted)", "chips", "missing", srcR, 0, { note: "no detectable languages" }),
      starredLangs.length
        ? f("Most-starred Stack", "chips", "derived", `${srcR} → top-starred repos .language`, 0.8, { values: starredLangs })
        : f("Most-starred Stack", "chips", "missing", srcR, 0, { note: "—" }),
      topics.length
        ? f("Repository Topics", "chips", "found", `${srcR} → .topics[]`, 0.95, { values: topics })
        : f("Repository Topics", "chips", "missing", `${srcR} → .topics[]`, 0, { note: "no topics tagged" }),
      f("Skill Endorsements", "text", "missing", "api.github.com (not exposed)", 0, { note: "GitHub's API has no self-reported skill graph — inferred from code signal instead" }),
    ],
  };
  hooks.module("gh-skills", "done");
  hooks.log(`✓ skills — ${langs.length} languages, ${topics.length} topics aggregated`, "ok");

  hooks.module("gh-activity", "active");
  let events: GhEvent[] = [];
  try {
    events = await apiGet<GhEvent[]>(`/users/${handle}/events/public?per_page=60`);
  } catch (e) {
    hooks.log(`⚠ events fetch failed — ${(e as Error).message}`, "warn");
  }
  const pushes = events.filter((e) => e.type === "PushEvent");
  const lastPush = pushes[0];
  const pushDays = new Set(pushes.map((e) => e.created_at.slice(0, 10))).size;
  const prs = events.filter((e) => e.type === "PullRequestEvent" && e.payload?.action === "created").length;
  const issues = events.filter((e) => e.type === "IssuesEvent" && e.payload?.action === "created").length;
  const level = pushDays >= 15 ? "High" : pushDays >= 5 ? "Moderate" : pushDays >= 1 ? "Low" : "Dormant";
  const srcE = `api.github.com/users/${handle}/events/public`;
  const activity: SourceModule = {
    id: "gh-activity",
    name: "Recent Activity",
    icon: "pulse",
    summary: events.length ? `${events.length} public events scanned (GitHub retains 90 days)` : "no events returned",
    fields: [
      lastPush
        ? f("Last Push", "text", "found", `${srcE} → PushEvent[0]`, 0.97, { value: `${lastPush.repo.name} @ ${(lastPush.payload?.ref ?? "refs/heads/main").replace("refs/heads/", "")} — ${lastPush.payload?.commits?.length ?? "?"} commit(s) · ${relTime(lastPush.created_at)}` })
        : f("Last Push", "text", "missing", srcE, 0, { note: "no PushEvent in window" }),
      f("Active Push Days (90d window)", "text", "derived", `${srcE} → distinct PushEvent dates`, 0.9, { value: `${pushDays} days` }),
      f("PRs / Issues Opened", "text", "derived", `${srcE} → action=created counts`, 0.9, { value: `${prs} PRs · ${issues} issues` }),
      f("Activity Level", "text", "derived", "SIEVE heuristic on push cadence", 0.75, { value: level }),
      events.length ? f("Events Scanned", "text", "found", srcE, 0.99, { value: `${events.length} events` }) : f("Events Scanned", "text", "missing", srcE, 0, { note: "empty" }),
    ],
  };
  hooks.module("gh-activity", "done");
  hooks.log(`✓ activity — ${pushDays} push days, level ${level}`, "ok");

  const modules = [identity, projects, skills, activity];
  hooks.source("github", "ok");
  return {
    id: "github", label: "GitHub", handle, status: "ok",
    headline: `${countStats(modules).found + countStats(modules).derived} live fields`,
    avatar: user.avatar_url, url: user.html_url,
    modules, traces, stats: countStats(modules),
  };
}

/* ================================================================== */
/*  LEETCODE — public stats, triple fallback                           */
/* ================================================================== */

interface LcStats {
  total: number; all: number; easy: number; easyAll: number;
  medium: number; mediumAll: number; hard: number; hardAll: number;
  ranking: number | null; reputation: number | null; acceptance: number | null;
  via: string;
}

async function extractLeetcode(handle: string, hooks: Hooks): Promise<SourceResult> {
  const traces: HttpTrace[] = [];
  const getJson = async (url: string, via: string): Promise<Record<string, unknown>> => {
    const t0 = performance.now();
    hooks.log(`→ GET ${url}`, "dim");
    const res = await fetchTimed(url, 10000);
    const text = await res.text();
    traces.push({ url, via, status: res.status, ok: res.ok, bytes: text.length, ms: Math.round(performance.now() - t0) });
    if (!res.ok || !text.trim().startsWith("{")) throw new Error(`HTTP ${res.status}`);
    hooks.log(`✓ ${res.status} · ${fmtBytes(text.length)} · ${Math.round(performance.now() - t0)} ms`, "ok");
    return JSON.parse(text) as Record<string, unknown>;
  };

  hooks.module("lc-stats", "active");
  let stats: LcStats | null = null;
  let lastErr = "";

  try {
    const j = await getJson(`https://leetcode-stats.de.a9sapp.eu/api/${handle}`, "leetcode-stats");
    if (j.status === "success" && typeof j.totalSolved === "number") {
      stats = {
        total: j.totalSolved as number, all: (j.totalQuestion as number) ?? 0,
        easy: (j.easySolved as number) ?? 0, easyAll: (j.totalEasy as number) ?? 0,
        medium: (j.mediumSolved as number) ?? 0, mediumAll: (j.totalMedium as number) ?? 0,
        hard: (j.hardSolved as number) ?? 0, hardAll: (j.totalHard as number) ?? 0,
        ranking: (j.ranking as number) ?? null, reputation: (j.reputation as number) ?? null,
        acceptance: typeof j.acceptanceRate === "number" ? j.acceptanceRate : null, via: "leetcode-stats.de.a9sapp.eu",
      };
    } else lastErr = "profile not found on leetcode-stats";
  } catch (e) { lastErr = (e as Error).message; hooks.log(`✕ leetcode-stats — ${lastErr}`, "warn"); }

  if (!stats) {
    try {
      const j = await getJson(`https://leetcode-api-faisalshohag.vercel.app/${handle}`, "leetcode-api-faisalshohag");
      if (typeof j.totalSolved === "number") {
        stats = {
          total: j.totalSolved as number, all: (j.totalQuestions as number) ?? 0,
          easy: (j.easySolved as number) ?? 0, easyAll: (j.totalEasy as number) ?? 0,
          medium: (j.mediumSolved as number) ?? 0, mediumAll: (j.totalMedium as number) ?? 0,
          hard: (j.hardSolved as number) ?? 0, hardAll: (j.totalHard as number) ?? 0,
          ranking: (j.ranking as number) ?? null, reputation: (j.reputation as number) ?? null,
          acceptance: typeof j.acceptanceRate === "number" ? j.acceptanceRate : null, via: "leetcode-api-faisalshohag.vercel.app",
        };
      } else lastErr = "profile not found on wrapper API";
    } catch (e) { lastErr = (e as Error).message; hooks.log(`✕ wrapper API — ${lastErr}`, "warn"); }
  }

  if (!stats) {
    try {
      const url = "https://corsproxy.io/?url=" + encodeURIComponent("https://leetcode.com/graphql");
      hooks.log(`→ POST leetcode.com/graphql via corsproxy.io`, "dim");
      const t0 = performance.now();
      const res = await fetchTimed(url, 12000, {
        method: "POST",
        headers: { "content-type": "application/json", referer: "https://leetcode.com" },
        body: JSON.stringify({
          query: `query userPublicProfile($username: String!) {
            matchedUser(username: $username) {
              username
              profile { ranking reputation }
              submitStatsGlobal { acSubmissionNum { difficulty count } }
            }
          }`,
          variables: { username: handle },
        }),
      });
      const text = await res.text();
      traces.push({ url: "https://leetcode.com/graphql", via: "corsproxy.io POST", status: res.status, ok: res.ok, bytes: text.length, ms: Math.round(performance.now() - t0) });
      const j = JSON.parse(text) as { data?: { matchedUser?: { profile?: { ranking?: number; reputation?: number }; submitStatsGlobal?: { acSubmissionNum?: { difficulty: string; count: number }[] } } } };
      const mu = j.data?.matchedUser;
      if (mu) {
        const n = (d: string) => mu.submitStatsGlobal?.acSubmissionNum?.find((x) => x.difficulty === d)?.count ?? 0;
        stats = {
          total: n("All"), all: 0, easy: n("Easy"), easyAll: 0, medium: n("Medium"), mediumAll: 0,
          hard: n("Hard"), hardAll: 0, ranking: mu.profile?.ranking ?? null,
          reputation: mu.profile?.reputation ?? null, acceptance: null, via: "leetcode.com/graphql (direct)",
        };
        hooks.log(`✓ graphql · ${res.status} · ${Math.round(performance.now() - t0)} ms`, "ok");
      } else lastErr = "matchedUser returned null (profile may be private or not exist)";
    } catch (e) { lastErr = (e as Error).message; hooks.log(`✕ graphql — ${lastErr}`, "warn"); }
  }

  if (!stats) {
    hooks.module("lc-stats", "done");
    hooks.source("leetcode", "failed");
    return {
      id: "leetcode", label: "LeetCode", handle, status: "failed",
      headline: "Stats unreachable", url: `https://leetcode.com/u/${handle}`,
      modules: [], traces,
      error: `All 3 public endpoints failed. Last error: ${lastErr}. The profile may be private, misspelled, or the free endpoints are rate-limiting.`,
      stats: { found: 0, derived: 0, missing: 0, auth: 0, error: 1 },
    };
  }

  const src = stats.via;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : a > 0 ? 100 : 0);
  const module_: SourceModule = {
    id: "lc-stats",
    name: "Solving Stats & Rank",
    icon: "trophy",
    summary: `${stats.total.toLocaleString()} problems solved · via ${src}`,
    fields: [
      f("Total Solved", "text", "found", `${src} → totalSolved`, 0.97, { value: stats.all ? `${stats.total.toLocaleString()} / ${stats.all.toLocaleString()}` : stats.total.toLocaleString() }),
      f("Difficulty Breakdown", "bars", "found", `${src} → easy/medium/hard`, 0.95, {
        bars: [
          { label: "Easy", pct: pct(stats.easy, stats.easyAll || stats.total), detail: stats.easyAll ? `${stats.easy}/${stats.easyAll}` : `${stats.easy} solved` },
          { label: "Medium", pct: pct(stats.medium, stats.mediumAll || stats.total), detail: stats.mediumAll ? `${stats.medium}/${stats.mediumAll}` : `${stats.medium} solved` },
          { label: "Hard", pct: pct(stats.hard, stats.hardAll || stats.total), detail: stats.hardAll ? `${stats.hard}/${stats.hardAll}` : `${stats.hard} solved` },
        ],
      }),
      stats.ranking
        ? f("Global Ranking", "text", "found", `${src} → ranking`, 0.95, { value: `#${stats.ranking.toLocaleString()}` })
        : f("Global Ranking", "text", "missing", `${src} → ranking`, 0, { note: "not returned by this endpoint" }),
      stats.reputation != null
        ? f("Reputation", "text", "found", `${src} → reputation`, 0.95, { value: stats.reputation.toLocaleString() })
        : f("Reputation", "text", "missing", `${src} → reputation`, 0, { note: "not returned" }),
      stats.acceptance != null
        ? f("Acceptance Rate", "text", "found", `${src} → acceptanceRate`, 0.9, { value: `${stats.acceptance}%` })
        : f("Acceptance Rate", "text", "missing", `${src} → acceptanceRate`, 0, { note: "requires full GraphQL query" }),
      f("Profile URL", "link", "found", "derived from handle", 0.99, { value: `https://leetcode.com/u/${handle}` }),
    ],
  };
  hooks.module("lc-stats", "done");
  hooks.log(`✓ leetcode — ${stats.total} solved, rank ${stats.ranking ?? "n/a"} via ${src}`, "ok");

  const modules = [module_];
  hooks.source("leetcode", "ok");
  return {
    id: "leetcode", label: "LeetCode", handle, status: "ok",
    headline: `${stats.total.toLocaleString()} solved · ${src}`,
    url: `https://leetcode.com/u/${handle}`,
    modules, traces, stats: countStats(modules),
  };
}

/* ================================================================== */
/*  orchestrator + export                                              */
/* ================================================================== */

export async function extractAll(targets: Targets, hooks: Hooks): Promise<Extraction> {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const results: SourceResult[] = [];

  const slug = parseLinkedinSlug(targets.linkedin);
  const gh = parseGithubHandle(targets.github);
  const lc = parseLeetcodeHandle(targets.leetcode);

  if (slug) {
    hooks.source("linkedin", "running");
    results.push(await extractLinkedin(slug, hooks));
  } else {
    results.push({ id: "linkedin", label: "LinkedIn", handle: "—", status: "off", headline: "not requested", modules: [], traces: [], stats: { found: 0, derived: 0, missing: 0, auth: 0, error: 0 } });
  }
  if (hooks.shouldAbort()) return { targets, results, startedAt, ms: Math.round(performance.now() - t0) };

  if (gh) {
    hooks.source("github", "running");
    results.push(await extractGithub(gh, hooks));
  } else {
    results.push({ id: "github", label: "GitHub", handle: "—", status: "off", headline: "not requested", modules: [], traces: [], stats: { found: 0, derived: 0, missing: 0, auth: 0, error: 0 } });
  }
  if (hooks.shouldAbort()) return { targets, results, startedAt, ms: Math.round(performance.now() - t0) };

  if (lc) {
    hooks.source("leetcode", "running");
    results.push(await extractLeetcode(lc, hooks));
  } else {
    results.push({ id: "leetcode", label: "LeetCode", handle: "—", status: "off", headline: "not requested", modules: [], traces: [], stats: { found: 0, derived: 0, missing: 0, auth: 0, error: 0 } });
  }

  return { targets, results, startedAt, ms: Math.round(performance.now() - t0) };
}

export function toExport(ex: Extraction): Record<string, unknown> {
  const fieldOut = (r: Field) => ({
    label: r.label,
    status: r.status,
    value: r.kind === "chips" || r.kind === "lines" ? r.values : r.kind === "bars" ? r.bars : r.value,
    source: r.source,
    confidence: r.conf,
    ...(r.note ? { note: r.note } : {}),
  });
  return {
    schema: "sieve.live-extraction/v2",
    generated_at: ex.startedAt,
    duration_ms: ex.ms,
    sources: Object.fromEntries(
      ex.results
        .filter((r) => r.status !== "off")
        .map((r) => [
          r.id,
          {
            handle: r.handle,
            status: r.status,
            url: r.url,
            headline: r.headline,
            field_stats: r.stats,
            http_traces: r.traces,
            ...(r.error ? { error: r.error } : {}),
            modules: r.modules.map((m) => ({
              id: m.id,
              name: m.name,
              fields: m.fields.map(fieldOut),
              entries: (m.entries ?? []).map((e) => ({ title: e.title, subtitle: e.subtitle, meta: e.meta, fields: e.fields.map(fieldOut) })),
            })),
          },
        ]),
    ),
    notes: [
      "found = parsed from a live HTTP response",
      "derived = computed from live data",
      "auth = behind LinkedIn authwall; requires maxun-core with a session cookie (Phase 01.5)",
      "missing = the source genuinely does not expose this",
    ],
  };
}
