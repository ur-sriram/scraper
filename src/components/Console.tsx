import { useEffect, useState } from "react";
import { Icon } from "./icons";
import type { Phase } from "../lib/types";

const SAMPLES = [
  { slug: "priya-sharma-ml", tag: "ML / RAG" },
  { slug: "marcus-chen-platform", tag: "DevOps" },
  { slug: "sofia-reyes-frontend", tag: "Full-stack" },
  { slug: "arjun-mehta-appsec", tag: "Security" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
  phase: Phase;
  error: string | null;
}

function RuntimeRow({ label, value, tone, blink }: { label: string; value: string; tone: string; blink?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[7px] border-b border-ink-700/50 last:border-0">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-fog-600">{label}</span>
      <span className="flex items-center gap-2 font-mono text-[11px] text-fog-300">
        <i
          className={`w-1.5 h-1.5 rounded-full ${blink ? "led-fast" : ""}`}
          style={{ background: tone, boxShadow: `0 0 8px ${tone}66` }}
        />
        {value}
      </span>
    </div>
  );
}

export function Console({ value, onChange, onSubmit, onAbort, phase, error }: Props) {
  const [uptime, setUptime] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setUptime((u) => u + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const running = phase === "running";
  const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="panel-frame reveal">
      <span className="corner" />
      <div className="grid lg:grid-cols-[1fr_300px]">
        {/* -------- target input -------- */}
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-mint-400">Extraction Console</span>
            <span className="h-px flex-1 bg-gradient-to-r from-mint-400/40 to-transparent" />
            <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-fog-600">depth: full · 11 modules</span>
          </div>

          <label htmlFor="target" className="block font-display text-2xl sm:text-[28px] font-semibold tracking-tight text-fog-100 mb-1">
            Feed it a profile. Get a knowledge graph.
          </label>
          <p className="text-fog-500 text-sm mb-6 max-w-xl leading-relaxed">
            Paste any public LinkedIn URL or username — SIEVE's maxun-core runtime walks the page, parses{" "}
            <span className="text-fog-300 font-mono text-[12.5px]">247 selector nodes</span> and returns a structured,
            embed-ready talent profile.
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
            className={`flex flex-col sm:flex-row gap-3 ${error ? "shake" : ""}`}
          >
            <div className={`flex-1 flex items-stretch border bg-ink-950/70 transition-colors focus-within:border-mint-400/70 ${error ? "border-blush-400/70" : "border-ink-600/70"}`}>
              <span className="hidden sm:flex items-center px-3 font-mono text-[12px] text-fog-600 border-r border-ink-700/70 select-none whitespace-nowrap">
                linkedin.com/in/
              </span>
              <input
                id="target"
                value={value}
                disabled={running}
                onChange={(e) => onChange(e.target.value)}
                placeholder="priya-sharma-ml"
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent px-3 sm:px-4 py-3.5 font-mono text-[13.5px] text-fog-100 placeholder-fog-600 outline-none min-w-0"
              />
              {running && <span className="flex items-center pr-3"><span className="w-2 h-4 bg-mint-400 cursor-blink" /></span>}
            </div>
            {running ? (
              <button
                type="button"
                onClick={onAbort}
                className="group flex items-center justify-center gap-2 px-6 py-3.5 border border-blush-400/60 text-blush-400 font-mono text-[12px] tracking-[0.18em] uppercase hover:bg-blush-400/10 transition-colors"
              >
                <Icon name="stop" className="w-3.5 h-3.5" /> Abort <span className="text-fog-600 normal-case tracking-normal hidden sm:inline">esc</span>
              </button>
            ) : (
              <button
                type="submit"
                className="group flex items-center justify-center gap-2.5 px-7 py-3.5 bg-mint-400 text-ink-950 font-mono text-[12px] font-semibold tracking-[0.18em] uppercase hover:bg-mint-300 active:translate-y-px transition-all shadow-[0_0_28px_rgba(62,207,142,0.25)]"
              >
                <Icon name="run" className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                Run extraction
                <span className="opacity-50 hidden sm:inline">⏎</span>
              </button>
            )}
          </form>

          {error && (
            <p className="mt-3 flex items-center gap-2 text-blush-400 text-[13px] font-mono">
              <Icon name="warn" className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fog-600 mr-1">Quick targets</span>
            {SAMPLES.map((smp) => (
              <button
                key={smp.slug}
                disabled={running}
                onClick={() => { onChange(smp.slug); }}
                className="group flex items-center gap-2 px-3 py-1.5 border border-ink-700 hover:border-mint-400/60 bg-ink-900/60 transition-colors disabled:opacity-40"
              >
                <span className="font-mono text-[12px] text-fog-300 group-hover:text-mint-300 transition-colors">/in/{smp.slug}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-ember-400/90 border border-ember-400/30 px-1.5 py-px">{smp.tag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* -------- runtime status -------- */}
        <aside className="border-t lg:border-t-0 lg:border-l border-ink-700/60 bg-ink-950/40 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-fog-600">Runtime</span>
            <span className={`flex items-center gap-1.5 font-mono text-[10.5px] ${running ? "text-mint-400" : "text-fog-500"}`}>
              <i className={`w-1.5 h-1.5 rounded-full ${running ? "bg-mint-400 led-fast" : "bg-mint-500"}`} style={{ boxShadow: "0 0 8px rgba(62,207,142,0.6)" }} />
              {running ? "SCRAPING" : "ONLINE"}
            </span>
          </div>
          <RuntimeRow label="Engine" value="maxun-core v0.9.2" tone="#3ecf8e" blink={running} />
          <RuntimeRow label="Selector map" value="linkedin-public@v11" tone="#3ecf8e" />
          <RuntimeRow label="Proxy pool" value="residential · IN/US/SG" tone="#f5b84b" />
          <RuntimeRow label="Anti-bot" value="stealth chromium" tone="#3ecf8e" />
          <RuntimeRow label="Uptime" value={`${pad(h)}:${pad(m)}:${pad(s)}`} tone="#5cc8ff" />

          <div className="mt-5 pt-4 border-t border-ink-700/50">
            <p className="font-mono text-[10.5px] leading-relaxed text-fog-600">
              Phase 01 target: <span className="text-fog-300">LinkedIn knowledge layer</span>. GitHub + LeetCode
              ingestion ships in Phases 02–03 and merges into the same embedding graph.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
