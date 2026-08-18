import { useState } from "react";
import { Icon } from "./icons";
import type { ExtractInput } from "../lib/engine";

interface ConsoleProps {
  targets: ExtractInput;
  onTarget: (patch: Partial<ExtractInput>) => void;
  pastedText: string;
  onPastedText: (v: string) => void;
  onRun: () => void;
  busy: boolean;
  error: string | null;
}

const SOURCES: { key: keyof ExtractInput; label: string; icon: string; prefix: string; placeholder: string; samples: { v: string; hint: string }[] }[] = [
  {
    key: "linkedin",
    label: "LinkedIn profile",
    icon: "linkedin",
    prefix: "in/",
    placeholder: "https://www.linkedin.com/in/ur-sriram/  or just the slug",
    samples: [
      { v: "ur-sriram", hint: "your test target" },
      { v: "williamhgates", hint: "public profile" },
    ],
  },
  {
    key: "github",
    label: "GitHub username",
    icon: "github",
    prefix: "gh/",
    placeholder: "username or github.com/username",
    samples: [
      { v: "gaearon", hint: "React core" },
      { v: "sindresorhus", hint: "900+ repos" },
    ],
  },
  {
    key: "leetcode",
    label: "LeetCode username",
    icon: "leetcode",
    prefix: "lc/",
    placeholder: "username or leetcode.com/u/username",
    samples: [
      { v: "kamyu104", hint: "top rank" },
      { v: "lee215", hint: "top rank" },
    ],
  },
];

export function Console({ targets, onTarget, pastedText, onPastedText, onRun, busy, error }: ConsoleProps) {
  const filled = [targets.linkedin, targets.github, targets.leetcode].filter((t) => (t ?? "").trim()).length;
  const [pasteOpen, setPasteOpen] = useState(false);

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
              LinkedIn is fetched live (rendered page reader + public HTML via CORS relays), GitHub hits the official
              REST API, LeetCode tries three public stats endpoints. Every value in the dossier below is parsed from
              those wire responses — <span className="text-mint-300">nothing is generated or guessed</span>.
            </p>

            <div className="space-y-4">
              {SOURCES.map((s) => (
                <div key={s.key}>
                  <label htmlFor={`t-${s.key}`} className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-fog-500 uppercase mb-1.5">
                    <Icon name={s.icon} className="w-3.5 h-3.5 text-mint-400" />
                    {s.label}
                    {s.key !== "linkedin" && <span className="text-fog-600 normal-case tracking-normal">· optional</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-fog-600 text-sm pointer-events-none">
                      {s.prefix}
                    </span>
                    <input
                      id={`t-${s.key}`}
                      type="text"
                      spellCheck={false}
                      autoComplete="off"
                      value={targets[s.key] ?? ""}
                      disabled={busy}
                      onChange={(e) => onTarget({ [s.key]: e.target.value } as Partial<ExtractInput>)}
                      onKeyDown={(e) => e.key === "Enter" && !busy && onRun()}
                      placeholder={s.placeholder}
                      className={`w-full bg-ink-950/80 border text-fog-100 placeholder:text-fog-600 font-mono text-sm px-3 py-2.5 pl-11 outline-none transition-colors focus:border-mint-400/70 disabled:opacity-50 ${
                        error && s.key === "linkedin" ? "border-blush-400/70" : "border-ink-600/70"
                      }`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="font-mono text-[10px] text-fog-600 self-center mr-1">try:</span>
                    {s.samples.map((sm) => (
                      <button
                        key={sm.v}
                        type="button"
                        disabled={busy}
                        onClick={() => onTarget({ [s.key]: sm.v } as Partial<ExtractInput>)}
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

            {/* paste fallback */}
            <div className="mt-5 border border-ink-700/70 bg-ink-950/40">
              <button
                type="button"
                onClick={() => setPasteOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left group"
              >
                <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-fog-500 uppercase group-hover:text-fog-300 transition-colors">
                  <Icon name="terminal" className="w-3.5 h-3.5 text-ember-400" />
                  authwall bypass — paste the profile text
                </span>
                <span className={`font-mono text-fog-600 transition-transform ${pasteOpen ? "rotate-90" : ""}`}>›</span>
              </button>
              {pasteOpen && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-fog-500 leading-relaxed mb-2">
                    If LinkedIn's authwall blocks the anonymous fetch, open the profile while signed in, select-all the
                    page text (or copy the rendered markdown), and paste it here. The extractor parses it locally with
                    the same field rules — <span className="text-ember-300">still your real data, never synthetic</span>.
                  </p>
                  <textarea
                    value={pastedText}
                    onChange={(e) => onPastedText(e.target.value)}
                    disabled={busy}
                    rows={5}
                    spellCheck={false}
                    placeholder="Paste the LinkedIn profile text / page source here…"
                    className="w-full bg-ink-950/80 border border-ink-600/70 text-fog-100 placeholder:text-fog-600 font-mono text-xs px-3 py-2.5 outline-none focus:border-ember-400/60 disabled:opacity-50 resize-y"
                  />
                  {pastedText.trim() && (
                    <p className="mt-1.5 font-mono text-[10px] text-ember-300">
                      {(pastedText.length / 1024).toFixed(1)} KB staged — will be used for the LinkedIn module
                    </p>
                  )}
                </div>
              )}
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
                { k: "engine", v: "sieve live-extract v2.1", mono: true },
                { k: "linkedin path", v: "jina reader + 3 CORS relays → parser", mono: true },
                { k: "github path", v: "api.github.com (direct, CORS-enabled)", mono: true },
                { k: "leetcode path", v: "stats API → wrapper → GraphQL", mono: true },
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
                <Icon name="shield" className="w-4 h-4 text-ember-400" />
                <span className="font-display text-sm font-semibold text-ember-300">The honest bit</span>
              </div>
              <p className="text-xs leading-relaxed text-fog-500">
                LinkedIn serves anonymous browsers an <span className="text-ember-300 font-mono">authwall</span>. The
                live tier extracts whatever the public shell exposes — name, headline, About, photo, and any public
                Experience / Education / Skills sections. What the wall locks is reported as{" "}
                <span className="font-mono text-ember-300">AUTH</span>, never invented. GitHub &amp; LeetCode are open
                APIs — that data is 100% live. Paste the profile text to unlock the rest without a backend.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
