import { Icon } from "./icons";
import type { Targets } from "../lib/engine";

interface ConsoleProps {
  targets: Targets;
  onTarget: (patch: Partial<Targets>) => void;
  onRun: () => void;
  busy: boolean;
  error: string | null;
}

const SUGGESTIONS: { key: keyof Targets; label: string; icon: string; samples: { v: string; hint: string }[] }[] = [
  {
    key: "linkedin",
    label: "LinkedIn profile",
    icon: "linkedin",
    samples: [
      { v: "williamhgates", hint: "public profile" },
      { v: "jeffweiner08", hint: "public profile" },
    ],
  },
  {
    key: "github",
    label: "GitHub username",
    icon: "github",
    samples: [
      { v: "gaearon", hint: "React core" },
      { v: "sindresorhus", hint: "900+ repos" },
    ],
  },
  {
    key: "leetcode",
    label: "LeetCode username",
    icon: "leetcode",
    samples: [
      { v: "kamyu104", hint: "top rank" },
      { v: "lee215", hint: "top rank" },
    ],
  },
];

export function Console({ targets, onTarget, onRun, busy, error }: ConsoleProps) {
  const filled = [targets.linkedin, targets.github, targets.leetcode].filter((t) => t.trim()).length;

  return (
    <section id="console" className="relative">
      <div className="panel-frame p-6 sm:p-8">
        <span className="corner" aria-hidden="true" />

        <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-8">
          {/* ------- targets ------- */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-mint-400">
                <span className="w-1.5 h-1.5 bg-mint-400 rounded-full led" />
                TARGET ACQUISITION
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-[28px] font-semibold tracking-tight text-fog-100 mb-1">
              Point the extractor at real handles.
            </h2>
            <p className="text-fog-500 text-sm max-w-xl mb-6">
              LinkedIn is fetched through public CORS relays (anonymous tier — expect an authwall), GitHub hits the
              official REST API, LeetCode tries three public stats endpoints. Every value shown later comes from those
              live responses — nothing is invented.
            </p>

            <div className="space-y-4">
              {SUGGESTIONS.map((s) => (
                <div key={s.key}>
                  <label htmlFor={`t-${s.key}`} className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-fog-500 uppercase mb-1.5">
                    <Icon name={s.icon} className="w-3.5 h-3.5 text-mint-400" />
                    {s.label}
                    {s.key !== "linkedin" && <span className="text-fog-600 normal-case tracking-normal">· optional</span>}
                  </label>
                  <div className="flex items-stretch gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-fog-600 text-sm pointer-events-none">
                        {s.key === "linkedin" ? "in/" : s.key === "github" ? "gh/" : "lc/"}
                      </span>
                      <input
                        id={`t-${s.key}`}
                        type="text"
                        spellCheck={false}
                        autoComplete="off"
                        value={targets[s.key]}
                        disabled={busy}
                        onChange={(e) => onTarget({ [s.key]: e.target.value } as Partial<Targets>)}
                        onKeyDown={(e) => e.key === "Enter" && !busy && onRun()}
                        placeholder={
                          s.key === "linkedin"
                            ? "https://www.linkedin.com/in/your-slug/"
                            : s.key === "github"
                              ? "username or github.com/username"
                              : "username or leetcode.com/u/username"
                        }
                        className={`w-full bg-ink-950/80 border text-fog-100 placeholder:text-fog-600 font-mono text-sm px-3 py-2.5 pl-11 outline-none transition-colors focus:border-mint-400/70 disabled:opacity-50 ${
                          error && s.key === "linkedin" ? "border-blush-400/70" : "border-ink-600/70"
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="font-mono text-[10px] text-fog-600 self-center mr-1">try:</span>
                    {s.samples.map((sm) => (
                      <button
                        key={sm.v}
                        type="button"
                        disabled={busy}
                        onClick={() => onTarget({ [s.key]: sm.v } as Partial<Targets>)}
                        className="group font-mono text-[11px] px-2 py-0.5 border border-ink-600/70 text-fog-300 hover:border-mint-400/60 hover:text-mint-300 transition-colors disabled:opacity-40"
                        title={sm.hint}
                      >
                        {sm.v}
                        <span className="text-fog-600 group-hover:text-mint-400/70 ml-1.5">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="shake mt-4 flex items-start gap-2 border border-blush-400/50 bg-blush-400/5 px-3 py-2.5 text-sm text-blush-400">
                <Icon name="warn" className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onRun}
                disabled={busy}
                className="group relative inline-flex items-center gap-3 bg-mint-400 text-ink-950 font-display font-semibold text-sm tracking-wide px-6 py-3 hover:bg-mint-300 active:translate-y-px transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <Icon name={busy ? "stop" : "run"} className="w-4 h-4" strokeWidth={2.2} />
                {busy ? "EXTRACTING — LIVE" : "RUN LIVE EXTRACTION"}
                <span className="font-mono text-[10px] font-medium opacity-70 border-l border-ink-950/30 pl-3">
                  {filled}/3 sources
                </span>
              </button>
              <p className="font-mono text-[11px] text-fog-600 max-w-[260px]">
                needs ≥ 1 handle · ESC aborts mid-run · anonymous GitHub tier = 60 req/h
              </p>
            </div>
          </div>

          {/* ------- runtime status ------- */}
          <aside className="border-l-0 lg:border-l border-ink-700/60 lg:pl-8">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] tracking-[0.18em] text-fog-500">RUNTIME</span>
              <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${busy ? "text-ember-400" : "text-mint-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${busy ? "bg-ember-400 led-fast" : "bg-mint-400"}`} />
                {busy ? "ON THE WIRE" : "IDLE"}
              </span>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                { k: "engine", v: "sieve live-extract v2", mono: true },
                { k: "linkedin path", v: "public page → 3 CORS relays → DOMParser", mono: true },
                { k: "github path", v: "api.github.com (direct, CORS-enabled)", mono: true },
                { k: "leetcode path", v: "stats API → wrapper → GraphQL relay", mono: true },
                { k: "auth tier", v: "Phase 01.5 · maxun-core + session cookie", mono: false },
              ].map((r) => (
                <div key={r.k} className="flex items-baseline justify-between gap-3 border-b border-ink-800/80 pb-2.5">
                  <dt className="font-mono text-[11px] text-fog-600 uppercase tracking-wider shrink-0">{r.k}</dt>
                  <dd className={`text-right text-fog-300 text-xs ${r.mono ? "font-mono" : ""}`}>{r.v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 border border-ember-400/30 bg-ember-400/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="lock" className="w-4 h-4 text-ember-400" />
                <span className="font-display text-sm font-semibold text-ember-300">The honest bit</span>
              </div>
              <p className="text-xs leading-relaxed text-fog-500">
                LinkedIn serves anonymous browsers an <span className="text-ember-300 font-mono">authwall</span> — so
                the live tier gets what the wall allows (name, headline, About excerpt, photo). Fields it locks are
                reported as <span className="font-mono text-ember-300">AUTH</span>, never faked. GitHub &amp; LeetCode
                are fully open APIs — that data is 100% live.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
