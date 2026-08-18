import { useCallback, useEffect, useRef, useState } from "react";
import { Console } from "./components/Console";
import { Pipeline, type ModuleUi, type SourceUi } from "./components/Pipeline";
import { Dossier } from "./components/Dossier";
import { Icon, LogoMark } from "./components/icons";
import {
  SOURCE_PLAN,
  extractAll,
  parseGithubHandle,
  parseLeetcodeHandle,
  parseLinkedinSlug,
  toExport,
  type Extraction,
  type SourceId,
  type Targets,
  type Tone,
} from "./lib/engine";
import type { Phase } from "./lib/types";

interface LogLine {
  t: string;
  text: string;
  tone: Tone;
}

const ROADMAP = [
  {
    tag: "01",
    name: "Public tier",
    state: "current",
    body: "Live LinkedIn meta parsing + GitHub REST + LeetCode stats — straight from the wire, in-browser.",
  },
  {
    tag: "01.5",
    name: "Auth tier",
    state: "next",
    body: "maxun-core with your session cookie + stealth Chromium unlocks the 12 auth-gated spec fields.",
  },
  {
    tag: "02",
    name: "Signal depth",
    state: "planned",
    body: "Commit graphs, PR review history, LeetCode calendar, recommendation NLP — evidence over claims.",
  },
  {
    tag: "03",
    name: "Embed & match",
    state: "planned",
    body: "Module-scoped chunks → vector store → cosine matching against job descriptions.",
  },
];

export default function App() {
  const [targets, setTargets] = useState<Targets>({
    linkedin: "https://www.linkedin.com/in/sebastin-louis/",
    github: "",
    leetcode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [sourceStatus, setSourceStatus] = useState<Record<SourceId, SourceUi>>({
    linkedin: "queued",
    github: "queued",
    leetcode: "queued",
  });
  const [moduleStatus, setModuleStatus] = useState<Record<string, ModuleUi>>({});
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  const abortRef = useRef(false);
  const startRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const showToast = useCallback((msg: string) => setToast({ id: Date.now(), msg }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  /* scroll-reveal for per-phase sections */
  useEffect(() => {
    const els = document.querySelectorAll(".reveal:not(.in)");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), obs.unobserve(e.target))),
      { threshold: 0.06 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [phase, extraction]);

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
    const li = parseLinkedinSlug(targets.linkedin);
    const gh = parseGithubHandle(targets.github);
    const lc = parseLeetcodeHandle(targets.leetcode);
    if (!li && !gh && !lc) {
      setError("Give me at least one real handle — a LinkedIn slug/URL, a GitHub username, or a LeetCode username.");
      return;
    }
    setError(null);
    abortRef.current = false;
    setPhase("running");
    setExtraction(null);
    setLogs([]);
    setElapsedMs(0);
    startRef.current = performance.now();

    setSourceStatus({
      linkedin: li ? "queued" : "off",
      github: gh ? "queued" : "off",
      leetcode: lc ? "queued" : "off",
    });
    const initModules: Record<string, ModuleUi> = {};
    SOURCE_PLAN.forEach((s) => s.modules.forEach((m) => (initModules[m.key] = "pending")));
    setModuleStatus(initModules);

    const fmtT = () => {
      const el = (performance.now() - startRef.current) / 1000;
      const m = Math.floor(el / 60);
      const s = (el % 60).toFixed(1).padStart(4, "0");
      return `[${String(m).padStart(2, "0")}:${s}]`;
    };
    const log = (text: string, tone: Tone = "info") => setLogs((ls) => [...ls, { t: fmtT(), text, tone }]);

    log(
      `sieve live-extract v2 · targets: ${[li && `linkedin/in/${li}`, gh && `gh/${gh}`, lc && `lc/${lc}`].filter(Boolean).join(" · ")}`,
      "dim",
    );

    try {
      const ex = await extractAll(targets, {
        log,
        source: (id, st) => setSourceStatus((s) => ({ ...s, [id]: st })),
        module: (k, st) => setModuleStatus((s) => ({ ...s, [k]: st })),
        shouldAbort: () => abortRef.current,
      });
      const total = performance.now() - startRef.current;
      if (abortRef.current) {
        log("✕ run aborted by operator — nothing fabricated, dossier withheld", "err");
        setPhase("aborted");
        return;
      }
      setExtraction(ex);
      const liveFields = ex.results.reduce((a, r) => a + r.stats.found + r.stats.derived, 0);
      const okCount = ex.results.filter((r) => r.status === "ok" || r.status === "partial").length;
      const failedCount = ex.results.filter((r) => r.status === "failed").length;
      log(
        `✔ wire work complete — ${liveFields} live fields from ${okCount}/${ex.results.filter((r) => r.status !== "off").length} source(s) in ${(total / 1000).toFixed(1)}s${failedCount ? ` · ${failedCount} failed (see dossier)` : ""}`,
        failedCount && !okCount ? "err" : "ok",
      );
      setPhase("done");
      setTimeout(() => document.getElementById("dossier")?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    } catch (e) {
      log(`✕ fatal — ${(e as Error).message}`, "err");
      setPhase("aborted");
    }
  };

  const onExport = () => {
    if (!extraction) return;
    const handles = [
      parseLinkedinSlug(extraction.targets.linkedin) ?? "x",
      parseGithubHandle(extraction.targets.github),
      parseLeetcodeHandle(extraction.targets.leetcode),
    ]
      .filter(Boolean)
      .join("+");
    const blob = new Blob([JSON.stringify(toExport(extraction), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sieve_live_${handles}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("extraction JSON downloaded — real fields only");
  };

  const onCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      showToast("clipboard blocked by browser");
    }
  };

  const showPipeline = phase !== "idle";

  return (
    <div className="relative min-h-screen">
      {/* ambient layers */}
      <div className="fixed inset-0 bg-blueprint pointer-events-none" aria-hidden="true" />
      <div className="fixed inset-0 noise-layer pointer-events-none" aria-hidden="true" />
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(900px 420px at 82% -10%, rgba(62,207,142,0.07), transparent 65%), radial-gradient(700px 400px at -10% 40%, rgba(92,200,255,0.05), transparent 60%)",
        }}
      />
      {phase === "running" && <div className="scan-overlay" aria-hidden="true" />}

      {/* header */}
      <header className="relative z-10 border-b border-ink-800/80 bg-ink-950/70 backdrop-blur-sm sticky top-0">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3">
          <LogoMark className="w-8 h-8" />
          <div className="leading-none">
            <div className="font-display font-bold tracking-tight text-lg text-fog-100">SIEVE</div>
            <div className="font-mono text-[9px] tracking-[0.22em] text-fog-600 mt-0.5">TALENT KNOWLEDGE EXTRACTOR</div>
          </div>
          <span className="hidden sm:inline-block font-mono text-[10px] text-mint-300 border border-mint-400/40 bg-mint-400/5 px-2 py-1 tracking-wider">
            PHASE 01 · LIVE PUBLIC TIER
          </span>
          <div className="ml-auto flex items-center gap-2 font-mono text-[11px] text-fog-500">
            <span className={`w-1.5 h-1.5 rounded-full ${phase === "running" ? "bg-ember-400 led-fast" : extraction ? "bg-mint-400" : "bg-fog-600"}`} />
            {phase === "running" ? "on the wire" : extraction ? "dossier ready" : phase === "aborted" ? "aborted" : "engine idle"}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-5">
        {/* masthead — left-aligned, not a hero trio */}
        <section className="pt-12 pb-10 grid lg:grid-cols-[1.3fr_0.7fr] gap-8 items-end">
          <div>
            <p className="font-mono text-[11px] tracking-[0.22em] text-mint-400 mb-4 flex items-center gap-2">
              <span className="w-6 h-px bg-mint-400/60" />
              SUPER JOB-SEARCH AI · PHASE 01 — THE LINKEDIN SCRAPER
            </p>
            <h1 className="font-display font-bold tracking-tight text-fog-100 text-[clamp(2rem,5.2vw,3.6rem)] leading-[1.04]">
              Real extraction.
              <br />
              <span className="text-fog-500">Zero invented fields.</span>
            </h1>
            <p className="mt-5 text-fog-500 max-w-xl leading-relaxed">
              Paste the handles your candidate gives you. SIEVE pulls the LinkedIn public page through CORS relays and
              parses what the wall allows, hits GitHub&apos;s official REST API, and queries LeetCode&apos;s public stats —
              every field below is stamped with the exact HTTP request it came from.
            </p>
          </div>
          <dl className="border border-ink-700/70 bg-ink-900/40 p-5 grid grid-cols-3 gap-4 text-center">
            {[
              { k: "3", v: "live sources" },
              { k: "3", v: "CORS relays" },
              { k: "0", v: "fake fields" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="font-display text-3xl font-bold text-mint-400">{s.k}</dt>
                <dd className="font-mono text-[10px] text-fog-600 tracking-wider uppercase mt-1">{s.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* console */}
        <Console targets={targets} onTarget={(p) => setTargets((t) => ({ ...t, ...p }))} onRun={run} busy={phase === "running"} error={error} />

        {/* pipeline */}
        {showPipeline && (
          <div className="mt-10 reveal">
            <Pipeline sourceStatus={sourceStatus} moduleStatus={moduleStatus} logs={logs} elapsed={elapsedMs} phase={phase} />
          </div>
        )}

        {/* aborted notice */}
        {phase === "aborted" && !extraction && (
          <div className="mt-8 border border-ember-400/40 bg-ember-400/5 p-5 flex items-start gap-3 reveal in">
            <Icon name="warn" className="w-5 h-5 text-ember-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-semibold text-ember-300">Run aborted</p>
              <p className="text-sm text-fog-500 mt-1">
                The wire log above shows how far the extraction got. Re-run when ready — nothing was cached or faked.
              </p>
            </div>
          </div>
        )}

        {/* dossier */}
        {extraction && (
          <div className="mt-10 reveal">
            <Dossier ex={extraction} onCopy={onCopy} onExport={onExport} />
          </div>
        )}

        {/* roadmap */}
        <section className="mt-16 pb-6 reveal">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-display text-xl font-semibold tracking-tight text-fog-100">Where this fits in the build</h2>
            <span className="font-mono text-[10.5px] text-fog-600 tracking-wider">PHASE TRACKER</span>
          </div>
          <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="hidden lg:block absolute top-[9px] left-0 right-0 h-px bg-ink-700/80" aria-hidden="true" />
            {ROADMAP.map((r) => (
              <div
                key={r.tag}
                className={`relative border p-4 pt-5 transition-colors ${
                  r.state === "current"
                    ? "border-mint-400/50 bg-mint-400/[0.05]"
                    : "border-ink-700/70 bg-ink-900/30 hover:border-ink-600"
                }`}
              >
                <span
                  className={`absolute -top-[9px] left-4 w-[17px] h-[17px] rounded-full border-2 ${
                    r.state === "current" ? "bg-mint-400 border-mint-400" : r.state === "next" ? "bg-ink-900 border-ember-400" : "bg-ink-900 border-ink-600"
                  }`}
                  aria-hidden="true"
                />
                <div className="flex items-center gap-2 mb-2">
                  <span className={`font-mono text-[10px] tracking-wider px-1.5 py-0.5 border ${r.state === "current" ? "text-mint-300 border-mint-400/50" : r.state === "next" ? "text-ember-300 border-ember-400/50" : "text-fog-600 border-ink-600"}`}>
                    {r.tag}
                  </span>
                  <span className="font-display font-semibold text-sm text-fog-100">{r.name}</span>
                </div>
                <p className="text-xs text-fog-500 leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-ink-800/80 mt-8">
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10.5px] text-fog-600">
          <span className="text-fog-500">SIEVE · phase 01 build</span>
          <span>runs 100% in your browser — requests go from you to LinkedIn / GitHub / LeetCode via public relays</span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Icon name="shield" className="w-3.5 h-3.5 text-mint-400" />
            no field is ever synthesized
          </span>
        </div>
      </footer>

      {/* toast */}
      {toast && (
        <div
          key={toast.id}
          className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 border border-mint-400/50 bg-ink-900 shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
          style={{ animation: "toastin 0.3s cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <Icon name="check" className="w-4 h-4 text-mint-400" strokeWidth={2.2} />
          <span className="font-mono text-xs text-fog-300">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
