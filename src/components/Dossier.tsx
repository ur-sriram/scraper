import { useMemo, useState } from "react";
import { Icon } from "./icons";
import type { Extraction, Field, FieldStatus, SourceResult } from "../lib/engine";

interface DossierProps {
  ex: Extraction;
  onCopy: (text: string, label: string) => void;
  onExport: () => void;
}

const STATUS_UI: Record<FieldStatus, { tag: string; cls: string; bar: string }> = {
  found: { tag: "LIVE", cls: "text-mint-300 border-mint-400/50 bg-mint-400/10", bar: "bg-mint-400" },
  derived: { tag: "DERIVED", cls: "text-skyx-300 border-skyx-400/50 bg-skyx-400/10", bar: "bg-skyx-400" },
  missing: { tag: "NOT PUBLIC", cls: "text-fog-500 border-ink-600 bg-ink-800/60", bar: "bg-fog-600" },
  auth: { tag: "AUTH", cls: "text-ember-300 border-ember-400/50 bg-ember-400/10", bar: "bg-ember-400" },
  error: { tag: "ERR", cls: "text-blush-400 border-blush-400/50 bg-blush-400/10", bar: "bg-blush-400" },
};

function StatusChip({ st }: { st: FieldStatus }) {
  const u = STATUS_UI[st];
  return (
    <span className={`inline-flex items-center font-mono text-[9.5px] tracking-wider border px-1.5 py-0.5 shrink-0 ${u.cls}`}>
      {u.tag}
    </span>
  );
}

function FieldRow({ field, onCopy }: { field: Field; onCopy: DossierProps["onCopy"] }) {
  const copyable =
    field.kind === "text" ? field.value : field.kind === "link" ? field.value : field.kind === "chips" || field.kind === "lines" ? field.values?.join(", ") : undefined;

  return (
    <div className="rowline border border-ink-800/70 bg-ink-900/40 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10.5px] tracking-wider text-fog-600 uppercase">{field.label}</span>
            <StatusChip st={field.status} />
          </div>

          {field.status === "found" || field.status === "derived" ? (
            <>
              {field.kind === "text" && <p className="text-sm text-fog-100 leading-relaxed">{field.value}</p>}
              {field.kind === "link" && (
                <a
                  href={field.value}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-mint-300 hover:text-mint-400 underline decoration-mint-400/30 underline-offset-4 break-all"
                >
                  {field.value}
                </a>
              )}
              {field.kind === "chips" && (
                <div className="flex flex-wrap gap-1.5">
                  {field.values?.map((v) => (
                    <span key={v} className="font-mono text-[11px] px-2 py-0.5 border border-ink-600/80 bg-ink-800/70 text-fog-300 hover:border-mint-400/50 hover:text-mint-300 transition-colors">
                      {v}
                    </span>
                  ))}
                </div>
              )}
              {field.kind === "lines" && (
                <ul className="space-y-1">
                  {field.values?.map((v, i) => (
                    <li key={i} className="text-sm text-fog-300 flex gap-2">
                      <span className="text-mint-400 mt-0.5 shrink-0">▸</span>
                      <span className="leading-relaxed">{v}</span>
                    </li>
                  ))}
                </ul>
              )}
              {field.kind === "bars" && (
                <div className="space-y-2 pt-1">
                  {field.bars?.map((b) => (
                    <div key={b.label}>
                      <div className="flex justify-between font-mono text-[10.5px] text-fog-500 mb-1">
                        <span>{b.label}</span>
                        <span className="text-fog-300">{b.detail}</span>
                      </div>
                      <div className="h-1.5 bg-ink-800 overflow-hidden">
                        <div
                          className={`h-full ${b.label === "Easy" ? "bg-mint-400" : b.label === "Medium" ? "bg-ember-400" : "bg-blush-400"}`}
                          style={{ width: `${Math.min(100, b.pct)}%`, transition: "width 0.9s cubic-bezier(0.22,1,0.36,1)" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className={`text-sm leading-relaxed ${field.status === "auth" ? "text-ember-300/80" : "text-fog-600 italic"}`}>
              {field.note ?? "—"}
            </p>
          )}
        </div>

        {copyable && (
          <button
            type="button"
            onClick={() => onCopy(copyable, field.label)}
            className="p-1.5 text-fog-600 hover:text-mint-300 hover:bg-mint-400/10 border border-transparent hover:border-mint-400/30 transition-colors shrink-0"
            title={`Copy ${field.label}`}
          >
            <Icon name="copy" className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[10px] text-fog-600">
        <span className="truncate" title={field.source}>
          ⌖ {field.source}
        </span>
        {(field.status === "found" || field.status === "derived") && (
          <span className="shrink-0">conf {(field.conf * 100).toFixed(0)}%</span>
        )}
      </div>
    </div>
  );
}

function matches(f: Field, q: string): boolean {
  const hay = [f.label, f.value ?? "", ...(f.values ?? []), f.source, f.note ?? ""].join(" ").toLowerCase();
  return hay.includes(q);
}

function SourceTab({ r, onCopy }: { r: SourceResult; onCopy: DossierProps["onCopy"] }) {
  const [q, setQ] = useState("");

  if (r.status === "failed") {
    return (
      <div className="border border-blush-400/40 bg-blush-400/[0.04] p-6">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="warn" className="w-4 h-4 text-blush-400" />
          <span className="font-display font-semibold text-blush-400">{r.label} extraction failed</span>
        </div>
        <p className="text-sm text-fog-300 leading-relaxed max-w-2xl">{r.error}</p>
        {r.traces.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full font-mono text-[11px] text-fog-500">
              <thead>
                <tr className="text-left text-fog-600">
                  <th className="pr-4 pb-1.5 font-medium">via</th>
                  <th className="pr-4 pb-1.5 font-medium">status</th>
                  <th className="pr-4 pb-1.5 font-medium">bytes</th>
                  <th className="pb-1.5 font-medium">ms</th>
                </tr>
              </thead>
              <tbody>
                {r.traces.map((t, i) => (
                  <tr key={i} className="border-t border-ink-800/70">
                    <td className="pr-4 py-1.5">{t.via}</td>
                    <td className={`pr-4 py-1.5 ${t.ok ? "text-mint-300" : "text-blush-400"}`}>{String(t.status)}</td>
                    <td className="pr-4 py-1.5">{t.bytes.toLocaleString()}</td>
                    <td className="py-1.5">{t.ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const query = q.trim().toLowerCase();

  const modules = r.modules
    .map((m) => ({
      ...m,
      fields: query ? m.fields.filter((f) => matches(f, query)) : m.fields,
      entries: query
        ? (m.entries ?? [])
            .map((e) => ({ ...e, fields: e.fields.filter((f) => matches(f, query)) }))
            .filter((e) => matches({ label: e.title, kind: "text", value: e.subtitle, status: "found", source: "", conf: 0 } as Field, query) || e.fields.length > 0)
        : m.entries,
    }))
    .filter((m) => m.fields.length > 0 || (m.entries?.length ?? 0) > 0 || !query);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Icon name="search" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-fog-600" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter live fields…"
            className="w-full bg-ink-950/80 border border-ink-600/70 text-fog-100 placeholder:text-fog-600 font-mono text-xs px-3 py-2 pl-9 outline-none focus:border-mint-400/70 transition-colors"
          />
        </div>
        <span className="font-mono text-[11px] text-fog-500">
          <span className="text-mint-300">{r.stats.found}</span> live ·{" "}
          <span className="text-skyx-300">{r.stats.derived}</span> derived ·{" "}
          <span className="text-ember-300">{r.stats.auth}</span> auth-gated ·{" "}
          <span className="text-fog-500">{r.stats.missing}</span> not public
        </span>
        {r.url && (
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-mint-300 hover:text-mint-400 border border-mint-400/40 px-2.5 py-1.5 hover:bg-mint-400/10 transition-colors"
          >
            <Icon name="globe" className="w-3.5 h-3.5" /> open source page
          </a>
        )}
      </div>

      {modules.map((m) => (
        <div key={m.id} className="border border-ink-700/70 bg-ink-900/30">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-ink-800/80">
            <Icon name={m.icon} className="w-4 h-4 text-mint-400" />
            <h4 className="font-display font-semibold text-sm text-fog-100">{m.name}</h4>
            <span className="font-mono text-[10.5px] text-fog-600 ml-auto">{m.summary}</span>
          </div>
          <div className="p-4 space-y-2.5">
            {m.fields.map((f, i) => (
              <FieldRow key={i} field={f} onCopy={onCopy} />
            ))}
            {m.entries?.map((e, i) => (
              <div key={`e${i}`} className="border border-ink-700/60 bg-ink-950/50 p-4 space-y-2.5 hover:border-mint-400/25 transition-colors">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display font-semibold text-fog-100">{e.title}</span>
                  {e.subtitle && <span className="font-mono text-[11px] text-mint-300">{e.subtitle}</span>}
                  {e.meta && <span className="font-mono text-[10.5px] text-fog-600 ml-auto">{e.meta}</span>}
                </div>
                {e.fields.map((f, j) => (
                  <FieldRow key={j} field={f} onCopy={onCopy} />
                ))}
              </div>
            ))}
            {m.fields.length === 0 && (m.entries?.length ?? 0) === 0 && (
              <p className="font-mono text-[11px] text-fog-600 py-2">no fields match “{q}”</p>
            )}
          </div>
        </div>
      ))}

      {r.traces.length > 0 && (
        <div className="border border-ink-700/70 bg-ink-900/30 p-4">
          <h4 className="font-mono text-[11px] tracking-[0.16em] text-fog-500 mb-3">HTTP PROVENANCE — {r.traces.length} request{r.traces.length > 1 ? "s" : ""}</h4>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-left text-fog-600">
                  <th className="pr-4 pb-2 font-medium">via</th>
                  <th className="pr-4 pb-2 font-medium">endpoint</th>
                  <th className="pr-4 pb-2 font-medium">status</th>
                  <th className="pr-4 pb-2 font-medium">bytes</th>
                  <th className="pb-2 font-medium">ms</th>
                </tr>
              </thead>
              <tbody className="text-fog-500">
                {r.traces.map((t, i) => (
                  <tr key={i} className="border-t border-ink-800/70">
                    <td className="pr-4 py-1.5 text-fog-300">{t.via}</td>
                    <td className="pr-4 py-1.5 max-w-[300px] truncate" title={t.url}>{t.url.replace("https://", "")}</td>
                    <td className={`pr-4 py-1.5 ${t.ok ? "text-mint-300" : "text-blush-400"}`}>{String(t.status)}</td>
                    <td className="pr-4 py-1.5">{t.bytes.toLocaleString()}</td>
                    <td className="py-1.5">{t.ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function Dossier({ ex, onCopy, onExport }: DossierProps) {
  const live = ex.results.filter((r) => r.status !== "off");
  const [tab, setTab] = useState(live[0]?.id ?? "linkedin");
  const active = live.find((r) => r.id === tab) ?? live[0];

  const totals = useMemo(() => {
    const t = { found: 0, derived: 0, missing: 0, auth: 0, error: 0 };
    live.forEach((r) => {
      t.found += r.stats.found;
      t.derived += r.stats.derived;
      t.missing += r.stats.missing;
      t.auth += r.stats.auth;
      t.error += r.stats.error;
    });
    return t;
  }, [ex]);

  const nameField = live
    .flatMap((r) => r.modules.flatMap((m) => m.fields))
    .find((f) => f.label === "Full Name" && (f.status === "found"));
  const displayName = nameField?.value ?? live.map((r) => r.handle).filter((h) => h !== "—").join(" · ");
  const headlineField = live.flatMap((r) => r.modules.flatMap((m) => m.fields)).find((f) => f.label === "Headline" && f.status === "found");
  const avatar = live.find((r) => r.avatar)?.avatar;
  const liveCount = totals.found + totals.derived;
  const livePct = liveCount + totals.missing + totals.auth + totals.error > 0
    ? Math.round((liveCount / (liveCount + totals.missing + totals.auth + totals.error)) * 100)
    : 0;

  return (
    <section id="dossier" className="scroll-mt-24">
      <div className="panel-frame p-6 sm:p-8">
        <span className="corner" aria-hidden="true" />

        {/* header */}
        <div className="flex flex-col md:flex-row md:items-center gap-5 mb-6">
          <div className="relative shrink-0">
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-16 h-16 border border-mint-400/40 object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-16 h-16 border border-ink-600 flex items-center justify-center font-display text-xl text-mint-400">
                {displayName.slice(0, 1).toUpperCase() || "?"}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-mint-400 border-2 border-ink-900" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] tracking-[0.18em] text-mint-400 mb-1">
              KNOWLEDGE DOSSIER · REAL EXTRACTION · {(ex.ms / 1000).toFixed(1)}s
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-fog-100 truncate">
              {displayName}
            </h3>
            {headlineField?.value && <p className="text-sm text-fog-500 mt-0.5 truncate">{headlineField.value}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-2 bg-mint-400 text-ink-950 font-display font-semibold text-xs px-4 py-2.5 hover:bg-mint-300 active:translate-y-px transition-all"
            >
              <Icon name="download" className="w-4 h-4" strokeWidth={2} />
              EXPORT JSON
            </button>
          </div>
        </div>

        {/* coverage strip */}
        <div className="mb-6 border border-ink-700/70 bg-ink-950/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="font-mono text-[11px] tracking-[0.16em] text-fog-500">COVERAGE — {liveCount} LIVE FIELDS ACROSS {live.length} SOURCE{live.length > 1 ? "S" : ""}</span>
            <span className="font-mono text-[11px] text-fog-300">
              <span className="text-mint-300">{totals.found} live</span> + <span className="text-skyx-300">{totals.derived} derived</span> ·{" "}
              <span className="text-ember-300">{totals.auth} auth-gated</span> · <span className="text-fog-500">{totals.missing} not public</span>
              {totals.error > 0 && <span className="text-blush-400"> · {totals.error} errors</span>}
            </span>
          </div>
          <div className="flex h-2 overflow-hidden bg-ink-800">
            <div className="bg-mint-400 conf-bar" style={{ width: `${(totals.found / Math.max(1, liveCount + totals.missing + totals.auth + totals.error)) * 100}%` }} />
            <div className="bg-skyx-400 conf-bar" style={{ width: `${(totals.derived / Math.max(1, liveCount + totals.missing + totals.auth + totals.error)) * 100}%`, animationDelay: "0.15s" }} />
            <div className="bg-ember-400/80 conf-bar" style={{ width: `${(totals.auth / Math.max(1, liveCount + totals.missing + totals.auth + totals.error)) * 100}%`, animationDelay: "0.3s" }} />
            <div className="bg-fog-600/60 conf-bar" style={{ width: `${(totals.missing / Math.max(1, liveCount + totals.missing + totals.auth + totals.error)) * 100}%`, animationDelay: "0.45s" }} />
          </div>
          <p className="mt-2.5 font-mono text-[10.5px] text-fog-600">
            {livePct}% of requested fields came back from real HTTP responses · the amber slice is what a maxun-core session unlocks in Phase 01.5
          </p>
        </div>

        {/* tabs */}
        <div className="flex flex-wrap gap-1.5 mb-5 border-b border-ink-800/80 pb-3">
          {live.map((r) => {
            const on = r.id === active.id;
            const stCls =
              r.status === "ok" ? "text-mint-300" : r.status === "partial" ? "text-ember-300" : "text-blush-400";
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setTab(r.id)}
                className={`inline-flex items-center gap-2 font-display text-sm font-semibold px-4 py-2 border transition-colors ${
                  on ? "border-mint-400/60 bg-mint-400/10 text-fog-100" : "border-ink-700/70 text-fog-500 hover:text-fog-300 hover:border-ink-600"
                }`}
              >
                <Icon name={r.id === "linkedin" ? "linkedin" : r.id === "github" ? "github" : "leetcode"} className="w-4 h-4" />
                {r.label}
                <span className={`font-mono text-[9.5px] tracking-wider ${stCls}`}>
                  {r.status === "ok" ? "● LIVE" : r.status === "partial" ? "◐ WALL" : "✕ FAIL"}
                </span>
              </button>
            );
          })}
        </div>

        <SourceTab key={active.id} r={active} onCopy={onCopy} />
      </div>
    </section>
  );
}
