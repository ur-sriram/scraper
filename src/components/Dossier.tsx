import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { countFields, moduleAvgConf, toExportPayload } from "../lib/generator";
import type { Entry, ModuleData, Profile, Row } from "../lib/types";

/* ---------------- reveal-on-scroll hook ---------------- */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("in");
            obs.disconnect();
          }
        });
      },
      { threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ---------------- confidence ---------------- */
function confColor(c: number) {
  if (c >= 0.88) return "#3ecf8e";
  if (c >= 0.74) return "#f5b84b";
  return "#ff7a7a";
}

function ConfMeter({ conf }: { conf: number }) {
  return (
    <span className="flex items-center gap-1.5 shrink-0" title={`extraction confidence ${(conf * 100).toFixed(0)}%`}>
      <span className="hidden sm:block w-9 h-[3px] bg-ink-700 overflow-hidden">
        <span className="conf-bar block h-full" style={{ width: `${conf * 100}%`, background: confColor(conf) }} />
      </span>
      <span className="font-mono text-[10px]" style={{ color: confColor(conf) }}>
        {(conf * 100).toFixed(0)}
      </span>
    </span>
  );
}

/* ---------------- row renderer ---------------- */
function RowView({ row, onCopy, dim }: { row: Row; onCopy: (text: string) => void; dim?: boolean }) {
  const plain = row.kind === "chips" || row.kind === "lines" ? (row.values ?? []).join(", ") : row.value ?? "";
  return (
    <button
      onClick={() => onCopy(`${row.label}: ${plain}`)}
      title="Click to copy field"
      className={`rowline w-full text-left grid grid-cols-[130px_1fr_auto] sm:grid-cols-[170px_1fr_auto_auto] items-start gap-x-4 gap-y-1 px-3.5 py-2.5 border border-transparent border-b border-ink-700/40 ${dim ? "opacity-30" : ""}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog-600 pt-[3px] leading-snug">{row.label}</span>
      <span className="min-w-0 text-[13.5px] leading-relaxed text-fog-100">
        {row.kind === "link" && row.value?.startsWith("http") ? (
          <a
            href={row.value}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-mint-300 hover:text-mint-400 underline decoration-mint-400/30 underline-offset-4 break-all"
          >
            <Icon name="link" className="w-3 h-3 shrink-0" /> {row.value}
          </a>
        ) : row.kind === "chips" ? (
          <span className="flex flex-wrap gap-1.5">
            {(row.values ?? []).map((v) => (
              <span key={v} className="px-2 py-0.5 bg-ink-750 border border-ink-600/60 text-fog-300 font-mono text-[11.5px] hover:border-mint-400/50 hover:text-mint-300 transition-colors">
                {v}
              </span>
            ))}
          </span>
        ) : row.kind === "lines" ? (
          <span className="block space-y-1">
            {(row.values ?? []).map((v, i) => (
              <span key={i} className="flex gap-2">
                <span className="text-mint-400/70 font-mono text-[11px] pt-[3px]">▸</span>
                <span className="text-fog-300">{v}</span>
              </span>
            ))}
          </span>
        ) : row.kind === "flag" ? (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[11px] border ${/yes/i.test(row.value ?? "") ? "text-mint-300 border-mint-400/40 bg-mint-950/60" : "text-fog-500 border-ink-600/60"}`}>
            <i className={`w-1.5 h-1.5 rounded-full ${/yes/i.test(row.value ?? "") ? "bg-mint-400 led" : "bg-fog-600"}`} />
            {row.value}
          </span>
        ) : (
          <span className={row.label === "About / Bio" || row.label === "Job Description" || row.label === "Description" || row.label === "Problem Solved" ? "text-fog-300" : ""}>{row.value}</span>
        )}
      </span>
      <span className="hidden lg:block font-mono text-[10px] text-fog-600 pt-[3px] max-w-[180px] truncate" title={row.src}>
        {row.src}
      </span>
      <ConfMeter conf={row.conf} />
    </button>
  );
}

function EntryCard({ entry, onCopy }: { entry: Entry; onCopy: (t: string) => void }) {
  return (
    <div className="border border-ink-700/70 bg-ink-900/60 hover:border-ink-600 transition-colors">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3.5 pb-2.5 border-b border-ink-700/50 bg-ink-850/60">
        <h4 className="font-display text-[15px] font-semibold text-fog-100">{entry.title}</h4>
        {entry.subtitle && <span className="text-[12.5px] text-mint-300/90">{entry.subtitle}</span>}
        {entry.meta && <span className="ml-auto font-mono text-[10.5px] text-fog-600">{entry.meta}</span>}
      </div>
      <div>
        {entry.rows.map((r, i) => (
          <RowView key={i} row={r} onCopy={onCopy} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- module section ---------------- */
function ModuleSection({ mod, index, onCopy }: { mod: ModuleData; index: number; onCopy: (t: string) => void }) {
  const ref = useReveal<HTMLDivElement>();
  const avg = moduleAvgConf(mod);
  return (
    <div ref={ref} id={`mod-${mod.id}`} className="reveal scroll-mt-24">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="w-9 h-9 grid place-items-center border border-mint-400/30 bg-mint-950/50 text-mint-400">
          <Icon name={mod.icon} className="w-[18px] h-[18px]" />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight text-fog-100 leading-none">
            <span className="font-mono text-[11px] text-fog-600 mr-2">{String(index + 1).padStart(2, "0")}</span>
            {mod.name}
          </h3>
          <p className="text-[11.5px] text-fog-500 mt-1 font-mono">{mod.summary}</p>
        </div>
        <span className="ml-auto flex items-center gap-2 font-mono text-[10.5px] text-fog-600">
          {countFields(mod)} fields · avg {Math.round(avg * 100)}%
        </span>
      </div>
      <div className="space-y-3">
        {mod.rows.length > 0 && (
          <div className="border border-ink-700/70 bg-ink-900/50 divide-y divide-ink-700/40">
            {mod.rows.map((r, i) => (
              <RowView key={i} row={r} onCopy={onCopy} />
            ))}
          </div>
        )}
        {(mod.entries ?? []).map((e, i) => (
          <EntryCard key={i} entry={e} onCopy={onCopy} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- dossier ---------------- */
interface Props {
  profile: Profile;
  elapsedSec: number;
  onToast: (msg: string) => void;
}

export function Dossier({ profile, elapsedSec, onToast }: Props) {
  const [active, setActive] = useState(profile.modules[0]?.id ?? "identity");
  const [query, setQuery] = useState("");
  const headRef = useReveal<HTMLDivElement>();
  const statsRef = useReveal<HTMLDivElement>();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast("Copied to clipboard");
    } catch {
      onToast("Clipboard unavailable");
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(toExportPayload(profile), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sieve-${profile.slug}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    onToast("sieve-" + profile.slug + ".json downloaded");
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(toExportPayload(profile), null, 2));
      onToast("Embedding payload copied as JSON");
    } catch {
      onToast("Clipboard unavailable");
    }
  };

  /* field search */
  const filtered = useMemo(() => {
    if (!query.trim()) return profile.modules;
    const q = query.trim().toLowerCase();
    const matchRow = (r: Row) =>
      r.label.toLowerCase().includes(q) ||
      (r.value ?? "").toLowerCase().includes(q) ||
      (r.values ?? []).some((v) => v.toLowerCase().includes(q));
    return profile.modules
      .map((m) => ({
        ...m,
        rows: m.rows.filter(matchRow),
        entries: (m.entries ?? []).map((e) => ({ ...e, rows: e.rows.filter(matchRow) })).filter((e) => e.rows.length > 0),
      }))
      .filter((m) => m.rows.length > 0 || (m.entries ?? []).length > 0);
  }, [profile, query]);

  const initials = profile.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const coverage = Math.round(profile.meta.avgConf * 1000) / 10;

  return (
    <section className="space-y-8" id="dossier">
      {/* ---------- profile header ---------- */}
      <div ref={headRef} className="reveal panel-frame p-6 sm:p-8">
        <span className="corner" />
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div
            className="w-20 h-20 shrink-0 grid place-items-center border font-display text-2xl font-bold text-ink-950 floaty"
            style={{
              background: `linear-gradient(135deg, hsl(${profile.avatarHue} 70% 62%), hsl(${(profile.avatarHue + 50) % 360} 70% 50%))`,
              boxShadow: `0 0 40px hsla(${profile.avatarHue}, 70%, 55%, 0.3)`,
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-fog-100">{profile.name}</h2>
              {profile.openToWork && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 border border-mint-400/50 bg-mint-950/60 text-mint-300 font-mono text-[10.5px] uppercase tracking-[0.14em]">
                  <i className="w-1.5 h-1.5 rounded-full bg-mint-400 led" /> open to work
                </span>
              )}
            </div>
            <p className="mt-1.5 text-fog-300 text-[14.5px] max-w-2xl">{profile.headline}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11.5px] text-fog-500">
              <span className="flex items-center gap-1.5"><Icon name="orbit" className="w-3.5 h-3.5 text-skyx-400" /> {profile.location}</span>
              <span className="flex items-center gap-1.5"><Icon name="layers" className="w-3.5 h-3.5 text-ember-400" /> {profile.industry}</span>
              <a href={profile.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-mint-300 hover:text-mint-400 underline decoration-mint-400/30 underline-offset-4">
                <Icon name="link" className="w-3.5 h-3.5" /> linkedin.com/in/{profile.slug}
              </a>
            </div>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <button onClick={copyJson} className="flex items-center gap-2 px-4 py-2.5 border border-mint-400/50 text-mint-300 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-mint-950/70 transition-colors">
              <Icon name="copy" className="w-3.5 h-3.5" /> Copy JSON
            </button>
            <button onClick={exportJson} className="flex items-center gap-2 px-4 py-2.5 bg-mint-400 text-ink-950 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] hover:bg-mint-300 transition-colors shadow-[0_0_24px_rgba(62,207,142,0.25)]">
              <Icon name="download" className="w-3.5 h-3.5" /> Export .json
            </button>
          </div>
        </div>
      </div>

      {/* ---------- stats strip ---------- */}
      <div ref={statsRef} className="reveal grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-ink-700/60 bg-ink-900/50 divide-x divide-y sm:divide-y-0 divide-ink-700/60">
        {[
          { k: "Fields extracted", v: String(profile.meta.fieldsTotal), tone: "text-mint-400" },
          { k: "Avg confidence", v: `${coverage}%`, tone: coverage >= 85 ? "text-mint-400" : "text-ember-400" },
          { k: "Modules", v: `${profile.modules.length}/11`, tone: "text-fog-100" },
          { k: "Scrape time", v: `${elapsedSec.toFixed(1)}s`, tone: "text-skyx-400" },
          { k: "Payload", v: `${profile.meta.payloadKB} KB`, tone: "text-fog-100" },
          { k: "Embed chunks", v: `≈ ${profile.meta.chunks}`, tone: "text-ember-400" },
        ].map((s) => (
          <div key={s.k} className="px-4 py-4">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-fog-600">{s.k}</p>
            <p className={`mt-1.5 font-display text-xl font-bold ${s.tone}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* ---------- body: sidebar + modules ---------- */}
      <div className="grid lg:grid-cols-[230px_1fr] gap-8 items-start">
        <aside className="hidden lg:block sticky top-24 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog-600 px-3 pb-2">Knowledge modules</p>
          {profile.modules.map((m, i) => {
            const on = active === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setActive(m.id);
                  document.getElementById(`mod-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 border-l-2 text-left transition-all ${
                  on ? "border-mint-400 bg-mint-950/50 text-fog-100" : "border-ink-700 text-fog-500 hover:text-fog-300 hover:border-ink-600"
                }`}
              >
                <span className={on ? "text-mint-400" : "text-fog-600"}><Icon name={m.icon} className="w-4 h-4" /></span>
                <span className="font-mono text-[11.5px] flex-1 truncate">{m.name}</span>
                <span className="font-mono text-[10px] text-fog-600">{countFields(m)}</span>
                {i === 0 && <span className="font-mono text-[8.5px] text-ember-400 border border-ember-400/40 px-1">CORE</span>}
              </button>
            );
          })}
          <div className="pt-4 px-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-600 pb-1.5">Coverage</p>
            <div className="h-[5px] bg-ink-700 overflow-hidden">
              <div className="conf-bar h-full bg-mint-400" style={{ width: `${coverage}%` }} />
            </div>
            <p className="mt-2 font-mono text-[10.5px] text-fog-600 leading-relaxed">
              {profile.meta.engine}<br />{profile.meta.selectorMap}
            </p>
          </div>
        </aside>

        <div className="space-y-10 min-w-0">
          {/* search */}
          <div className="flex items-center gap-3 border border-ink-700/70 bg-ink-900/60 px-4 py-3 focus-within:border-mint-400/60 transition-colors">
            <Icon name="search" className="w-4 h-4 text-fog-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 100+ extracted fields — try “PyTorch”, “certifications”, “recommendations”…"
              className="flex-1 bg-transparent outline-none font-mono text-[12.5px] text-fog-100 placeholder-fog-600"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-fog-600 hover:text-blush-400 transition-colors">
                <Icon name="cross" className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="font-mono text-[10.5px] text-fog-600 whitespace-nowrap">
              {filtered.reduce((a, m) => a + countFields(m), 0)} hits
            </span>
          </div>

          {query && filtered.length === 0 && (
            <p className="font-mono text-[12.5px] text-fog-500 py-10 text-center">
              No fields match “{query}” — the graph says <span className="text-blush-400">null</span>.
            </p>
          )}

          {filtered.map((m) => (
            <ModuleSection key={m.id} mod={m} index={profile.modules.findIndex((x) => x.id === m.id)} onCopy={copy} />
          ))}

          {/* embedding payload teaser */}
          <EmbedTeaser profile={profile} onToast={onToast} />
        </div>
      </div>
    </section>
  );
}

function EmbedTeaser({ profile, onToast }: { profile: Profile; onToast: (m: string) => void }) {
  const ref = useReveal<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const payload = useMemo(() => JSON.stringify(toExportPayload(profile), null, 2), [profile]);
  return (
    <div ref={ref} className="reveal border border-ember-400/30 bg-ink-900/60">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <Icon name="bolt" className="w-4 h-4 text-ember-400" />
        <span className="font-display text-[15px] font-semibold text-fog-100">Embedding payload preview</span>
        <span className="font-mono text-[10.5px] text-fog-600">sieve.talent-profile/v1 · {profile.meta.chunks} chunks · field-weighted</span>
        <span className={`ml-auto font-mono text-[11px] text-ember-400 transition-transform ${open ? "rotate-90" : ""}`}><Icon name="arrow" className="w-4 h-4" /></span>
      </button>
      {open && (
        <pre className="mx-5 mb-5 p-4 bg-ink-950/80 border border-ink-700/60 overflow-x-auto max-h-80 overflow-y-auto font-mono text-[11px] leading-relaxed text-fog-300">
          {payload.slice(0, 2600)}
          {payload.length > 2600 ? "\n  … (" + (payload.length - 2600) + " more chars)" : ""}
        </pre>
      )}
      <div className="px-5 pb-4">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(payload);
              onToast("Full payload copied — ready for the vector store");
            } catch {
              onToast("Clipboard unavailable");
            }
          }}
          className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ember-400 hover:text-ember-300 transition-colors flex items-center gap-2"
        >
          <Icon name="copy" className="w-3 h-3" /> Copy full payload for Phase 04 ingestion
        </button>
      </div>
    </div>
  );
}
