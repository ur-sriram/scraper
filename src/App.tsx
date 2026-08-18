import { useCallback, useEffect, useRef, useState } from "react";
import { Console } from "./components/Console";
import { Pipeline } from "./components/Pipeline";
import { Dossier } from "./components/Dossier";
import { Icon, LogoMark } from "./components/icons";
import {
  countFields,
  generateProfile,
  moduleAvgConf,
  parseSlug,
} from "./lib/generator";
import type { LogLine, ModuleStatus, Phase, Profile } from "./lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export default function App() {
  const [url, setUrl] = useState("priya-sharma-ml");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ModuleStatus>>({});
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  const abortRef = useRef(false);
  const startRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const showToast = useCallback((msg: string) => {
    setToast({ id: Date.now(), msg });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  /* global scroll-reveal for sections mounted per phase */
  useEffect(() => {
    const els = document.querySelectorAll(".reveal:not(.in)");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), obs.unobserve(e.target))),
      { threshold: 0.06 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [phase, profile]);

  /* elapsed ticker */
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setElapsedMs(performance.now() - startRef.current), 100);
    return () => clearInterval(t);
  }, [phase]);

  /* esc aborts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phaseRef.current === "running") abortRef.current = true;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = async () => {
    const slug = parseSlug(url);
    if (!slug) {
      setError("That doesn't look like a LinkedIn handle. Use linkedin.com/in/<slug> or just the slug.");
      return;
    }
    setError(null);
    abortRef.current = false;
    setPhase("running");
    setProfile(null);
    setLogs([]);
    setElapsedMs(0);
    startRef.current = performance.now();

    const fmtT = () => {
      const el = (performance.now() - startRef.current) / 1000;
      const m = Math.floor(el / 60);
      const s = (el % 60).toFixed(1).padStart(4, "0");
      return `[${String(m).padStart(2, "0")}:${s}]`;
    };
    const log = async (text: string, tone: LogLine["tone"], delay: number) => {
      await sleep(delay);
      setLogs((ls) => [...ls, { t: fmtT(), text, tone }]);
    };

    const p = generateProfile(slug);
    setProfile(p);
    setStatuses(Object.fromEntries(p.modules.map((m) => [m.id, "queued" as ModuleStatus])));

    await log(`resolving target → https://www.linkedin.com/in/${slug}/`, "dim", 220);
    await log("acquiring proxy … residential pool (geo IN/US/SG) ✓", "info", rnd(300, 520));
    await log(`GET /in/${slug} → 200 OK · ${p.meta.payloadKB} KB raw DOM`, "info", rnd(420, 700));
    await log("anti-bot checkpoint passed · stealth chromium fingerprint rotated", "dim", rnd(280, 460));
    await log(`selector map ${p.meta.selectorMap} loaded`, "dim", rnd(200, 380));

    for (const m of p.modules) {
      if (abortRef.current) break;
      setStatuses((s) => ({ ...s, [m.id]: "running" }));
      await log(`▸ ${m.name.toLowerCase()} — walking ${m.srcRoot}`, "info", rnd(240, 420));
      await sleep(rnd(280, 540));
      if (abortRef.current) break;
      setStatuses((s) => ({ ...s, [m.id]: "done" }));
      const avg = moduleAvgConf(m);
      await log(
        `✓ ${m.name.toLowerCase()} · ${countFields(m)} fields · conf ${(avg * 100).toFixed(0)}%`,
        "ok",
        rnd(90, 200),
      );
      if (avg < 0.79) {
        await log(`⚠ ${m.name.toLowerCase()}: some fields under 0.75 — flagged for human review`, "warn", rnd(60, 140));
      }
    }

    const total = performance.now() - startRef.current;
    if (abortRef.current) {
      setStatuses((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === "done" ? "done" : "queued"])));
      await log("✕ run aborted by operator — partial dossier retained", "err", 120);
      setFinalMs(total);
      setPhase("aborted");
      return;
    }
    setFinalMs(total);
    await log(
      `✔ extraction complete — ${p.meta.fieldsTotal} fields · avg conf ${(p.meta.avgConf * 100).toFixed(1)}% · ${p.meta.payloadKB} KB`,
      "ok",
      260,
    );
    await log(`→ knowledge graph written · ≈ ${p.meta.chunks} chunks queued for Phase 04 embedding`, "dim", 300);
    setPhase("done");
    setTimeout(() => document.getElementById("dossier")?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
  };

  const running = phase === "running";
  const showPipeline = logs.length > 0;

  return (
    <div className="relative min-h-screen">
      {/* ---------- ambient background ---------- */}
      <div className="fixed inset-0 -z-10 bg-ink-950">
        <div className="absolute inset-0 bg-blueprint" />
        <div className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full opacity-[0.13]" style={{ background: "radial-gradient(circle, #3ecf8e 0%, transparent 65%)" }} />
        <div className="absolute top-1/3 -right-52 w-[620px] h-[620px] rounded-full opacity-[0.09]" style={{ background: "radial-gradient(circle, #f5b84b 0%, transparent 65%)" }} />
        <div className="absolute -bottom-52 left-1/4 w-[520px] h-[520px] rounded-full opacity-[0.08]" style={{ background: "radial-gradient(circle, #5cc8ff 0%, transparent 65%)" }} />
        <div className="absolute inset-0 noise-layer" />
      </div>
      {running && <div className="scan-overlay" />}

      {/* ---------- header ---------- */}
      <header className="sticky top-0 z-50 border-b border-ink-700/70 bg-ink-950/95">
        <div className="h-[2px] bg-gradient-to-r from-mint-400 via-ember-400 to-skyx-400 opacity-70" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <a href="#" className="flex items-center gap-3 group">
            <LogoMark className="w-8 h-8 transition-transform group-hover:-rotate-6" />
            <span className="leading-none">
              <span className="font-display text-lg font-bold tracking-[0.08em] text-fog-100">SIEVE</span>
              <span className="block font-mono text-[9px] tracking-[0.22em] uppercase text-fog-600 mt-0.5">talent intelligence engine</span>
            </span>
          </a>
          <nav className="ml-auto hidden md:flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em]">
            <span className="px-2.5 py-1 border border-mint-400/40 text-mint-300 bg-mint-950/40">Phase 01 · LinkedIn</span>
            <span className="px-2.5 py-1 border border-ink-700 text-fog-600">02 · GitHub</span>
            <span className="px-2.5 py-1 border border-ink-700 text-fog-600">03 · LeetCode</span>
            <span className="px-2.5 py-1 border border-ink-700 text-fog-600">04 · Matcher</span>
          </nav>
          <a
            href="https://github.com/getmaxun/maxun"
            target="_blank"
            rel="noreferrer"
            className="ml-auto md:ml-4 flex items-center gap-2 px-3 py-1.5 border border-ink-700 hover:border-mint-400/50 transition-colors font-mono text-[10.5px] text-fog-500 hover:text-mint-300"
          >
            <i className={`w-1.5 h-1.5 rounded-full ${running ? "bg-ember-400 led-fast" : "bg-mint-400"}`} style={{ boxShadow: "0 0 8px rgba(62,207,142,.6)" }} />
            runtime: maxun
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        {/* ---------- console ---------- */}
        <div className="pt-8 sm:pt-12">
          <Console
            value={url}
            onChange={(v) => { setUrl(v); setError(null); }}
            onSubmit={run}
            onAbort={() => { abortRef.current = true; }}
            phase={phase}
            error={error}
          />
          <p className="mt-3 font-mono text-[10.5px] text-fog-600 flex items-center gap-2">
            <Icon name="shield" className="w-3.5 h-3.5 text-mint-500" />
            Demo dossiers are synthesized deterministically per slug — same handle, same graph, every time.
          </p>
        </div>

        {/* ---------- pipeline ---------- */}
        {showPipeline && profile && (
          <div className="mt-10">
            <Pipeline modules={profile.modules} statuses={statuses} logs={logs} elapsedMs={running ? elapsedMs : finalMs} phase={phase} />
          </div>
        )}

        {/* ---------- dossier ---------- */}
        {phase === "done" && profile && (
          <div className="mt-12">
            <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="font-mono text-[10.5px] tracking-[0.24em] uppercase text-mint-400 mb-2">Extraction dossier</p>
                <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-tight leading-none text-fog-100">
                  Super-knowledge, <span className="text-mint-400">extracted.</span>
                </h2>
              </div>
              <p className="font-mono text-[11px] text-fog-600 max-w-xs text-right">
                every field carries a confidence score + source selector — click any row to copy.
              </p>
            </div>
            <Dossier profile={profile} elapsedSec={finalMs / 1000} onToast={showToast} />
          </div>
        )}

        {phase === "aborted" && (
          <div className="mt-10 border border-blush-400/40 bg-ink-900/70 p-6 reveal in flex items-center gap-4">
            <Icon name="warn" className="w-6 h-6 text-blush-400 shrink-0" />
            <div>
              <p className="font-display text-lg font-semibold text-fog-100">Run aborted at {(finalMs / 1000).toFixed(1)}s</p>
              <p className="text-fog-500 text-sm mt-0.5">The partial log is retained above. Hit <span className="font-mono text-mint-300">Run extraction</span> to retry — the graph for this slug is deterministic.</p>
            </div>
          </div>
        )}

        {/* ---------- roadmap ---------- */}
        <section className="mt-20">
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-fog-600">System roadmap</span>
            <span className="h-px flex-1 bg-ink-700" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { n: "01", t: "LinkedIn extraction", d: "247-node selector walk → 11-module knowledge graph with confidence scoring.", s: phase === "done" ? "COMPLETE" : "ACTIVE", tone: "mint" },
              { n: "02", t: "GitHub ingestion", d: "Repos, commit cadence, code-quality signals and OSS impact merged into the graph.", s: "NEXT", tone: "ember" },
              { n: "03", t: "LeetCode signals", d: "Problem stats, contest rating and topic mastery as skill-evidence weights.", s: "QUEUED", tone: "sky" },
              { n: "04", t: "Embedding + matcher", d: "Field-weighted chunking → vector store → ranked job matching with explainability.", s: "QUEUED", tone: "sky" },
            ].map((p) => {
              const color = p.tone === "mint" ? "#3ecf8e" : p.tone === "ember" ? "#f5b84b" : "#5cc8ff";
              return (
                <div key={p.n} className="relative border border-ink-700/70 bg-ink-900/50 p-5 hover:border-ink-600 transition-colors group">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-2xl font-bold text-ink-600 group-hover:text-ink-600/80 transition-colors">{p.n}</span>
                    <span className="font-mono text-[9.5px] tracking-[0.18em] px-2 py-0.5 border" style={{ color, borderColor: `${color}55`, background: `${color}0f` }}>{p.s}</span>
                  </div>
                  <h3 className="mt-3 font-display text-[15.5px] font-semibold text-fog-100">{p.t}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-fog-500">{p.d}</p>
                  <div className="mt-4 h-[2px] w-10 transition-all duration-500 group-hover:w-full" style={{ background: `${color}66` }} />
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ---------- footer ---------- */}
      <footer className="border-t border-ink-700/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10.5px] text-fog-600">
          <span className="flex items-center gap-2 text-fog-500"><LogoMark className="w-4 h-4" /> SIEVE v0.1 — super job-search AI</span>
          <span>extraction runtime: <a href="https://github.com/getmaxun/maxun" target="_blank" rel="noreferrer" className="text-mint-400/80 hover:text-mint-300">getmaxun/maxun</a></span>
          <span className="ml-auto">© 2026 · Phase 01 of 04 · public profiles only</span>
        </div>
      </footer>

      {/* ---------- toast ---------- */}
      {toast && (
        <div key={toast.id} className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 border border-mint-400/50 bg-ink-900 shadow-[0_8px_40px_rgba(0,0,0,0.5)]" style={{ animation: "toastin 0.3s cubic-bezier(0.22,1,0.36,1) both" }}>
          <Icon name="check" className="w-4 h-4 text-mint-400" />
          <span className="font-mono text-[12px] text-fog-100">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
