import { useEffect, useRef } from "react";
import { Icon } from "./icons";
import type { ExtractInput, LogTone, ModuleData, SourceId, SourceUi, TierOutcome } from "../lib/engine";

export interface LogLine {
  t: string;
  text: string;
  tone: LogTone;
}

interface PipelineProps {
  sourceStatus: Record<SourceId, SourceUi>;
  modules: Record<SourceId, ModuleData[]>;
  tiers: Record<SourceId, TierOutcome[]>;
  targets: ExtractInput;
  logs: LogLine[];
  elapsedMs: number;
  phase: "idle" | "running" | "done" | "aborted";
}

const SOURCE_META: { id: SourceId; label: string; icon: string; desc: string }[] = [
  { id: "linkedin", label: "LinkedIn", icon: "linkedin", desc: "rendered page → public shell parser" },
  { id: "github", label: "GitHub", icon: "github", desc: "REST v3 · users / repos / events" },
  { id: "leetcode", label: "LeetCode", icon: "leetcode", desc: "public stats · triple fallback" },
];

const UI: Record<SourceUi, { txt: string; cls: string; dot: string }> = {
  queued: { txt: "QUEUED", cls: "text-fog-600", dot: "bg-ink-600" },
  running: { txt: "ON WIRE", cls: "text-ember-300", dot: "bg-ember-400 led-fast" },
  done: { txt: "LIVE", cls: "text-mint-300", dot: "bg-mint-400" },
  failed: { txt: "WALLED", cls: "text-blush-400", dot: "bg-blush-400" },
  off: { txt: "SKIPPED", cls: "text-fog-600", dot: "bg-ink-700" },
};

const TONE_CLS: Record<LogTone, string> = {
  info: "text-skyx-300",
  ok: "text-mint-300",
  warn: "text-ember-300",
  dim: "text-fog-500",
  err: "text-blush-400",
};

export function Pipeline({ sourceStatus, modules, tiers, targets, logs, elapsedMs, phase }: PipelineProps) {
  const termRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const active = SOURCE_META.filter((s) => (targets[s.id] ?? "").trim().length > 0);
  const liveCount = logs.length;

  return (
    <section id="pipeline" className="scroll-mt-24">
      <div className="panel-frame p-6 sm:p-8">
        <span className="corner" aria-hidden="true" />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-mint-400">
            <span className={`w-1.5 h-1.5 rounded-full ${phase === "running" ? "bg-ember-400 led-fast" : "bg-mint-400"}`} />
            EXTRACTION PIPELINE
          </span>
          <span className="font-mono text-[11px] text-fog-500 ml-auto flex items-center gap-2">
            <Icon name="clock" className="w-3.5 h-3.5" />
            {(elapsedMs / 1000).toFixed(1)}s
            <span className="text-fog-600">·</span>
            {liveCount} wire events
          </span>
        </div>

        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
          {/* ---- source trackers ---- */}
          <div className="space-y-3">
            {SOURCE_META.map((s) => {
              const isActive = (targets[s.id] ?? "").trim().length > 0;
              const st = isActive ? sourceStatus[s.id] : "off";
              const ui = UI[st];
              const mods = modules[s.id] ?? [];
              return (
                <div
                  key={s.id}
                  className={`border p-4 transition-colors ${
                    st === "running" ? "border-ember-400/50 bg-ember-400/[0.04]" : st === "done" ? "border-mint-400/30 bg-mint-400/[0.03]" : "border-ink-700/60 bg-ink-900/30"
                  } ${!isActive ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon name={s.icon} className={`w-4 h-4 ${st === "done" ? "text-mint-400" : st === "running" ? "text-ember-400" : "text-fog-600"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-sm text-fog-100">{s.label}</span>
                        <span className={`font-mono text-[9.5px] tracking-wider ${ui.cls}`}>● {ui.txt}</span>
                      </div>
                      <p className="font-mono text-[10px] text-fog-600 truncate">{s.desc}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${ui.dot}`} />
                  </div>
                  {mods.length > 0 && (st === "done" || st === "failed") && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {mods.map((m) => (
                        <span key={m.id} className="font-mono text-[9.5px] px-1.5 py-0.5 border border-ink-600/70 text-fog-500 flex items-center gap-1">
                          <Icon name={m.icon} className="w-2.5 h-2.5 text-mint-400/70" />
                          {m.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {st === "running" && (
                    <div className="mt-3 h-0.5 overflow-hidden bg-ink-800">
                      <div className="h-full w-full tickflow" />
                    </div>
                  )}

                  {(tiers[s.id] ?? []).length > 0 && (st === "done" || st === "failed") && (
                    <div className="mt-3 border-t border-ink-800/70 pt-2.5">
                      <div className="font-mono text-[9px] tracking-[0.2em] text-fog-600 mb-1.5">LOO PHOLE LADDER</div>
                      <div className="space-y-1">
                        {(tiers[s.id] ?? []).map((t) => (
                          <div key={t.tier} className="flex items-center gap-2 font-mono text-[10px]">
                            <span className="text-mint-400 w-6 shrink-0">{t.tier}</span>
                            <span className={`w-12 shrink-0 ${t.status === "hit" ? "text-mint-300" : t.status === "skip" ? "text-fog-600" : "text-ember-300"}`}>
                              {t.status === "hit" ? "● HIT" : t.status === "skip" ? "○ SKIP" : "✕ MISS"}
                            </span>
                            <span className="text-fog-300 truncate">{t.name}</span>
                            {t.fields > 0 && <span className="text-mint-300 ml-auto shrink-0">+{t.fields}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-ink-800/70">
              {[
                ["bg-mint-400", "LIVE — parsed from response"],
                ["bg-skyx-400", "DERIVED — computed"],
                ["bg-ember-400", "AUTH — behind login"],
                ["bg-fog-600", "NOT PUBLIC"],
              ].map(([c, t]) => (
                <span key={t} className="inline-flex items-center gap-1.5 font-mono text-[9.5px] text-fog-600">
                  <span className={`w-1.5 h-1.5 ${c}`} />
                  {t}
                </span>
              ))}
            </div>
            {!active.length && (
              <p className="font-mono text-[11px] text-fog-600">no targets armed — enter a handle above</p>
            )}
          </div>

          {/* ---- terminal ---- */}
          <div className="border border-ink-700/70 bg-ink-950/80 flex flex-col min-h-[320px]">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-800/80">
              <span className="w-2 h-2 rounded-full bg-blush-400/70" />
              <span className="w-2 h-2 rounded-full bg-ember-400/70" />
              <span className="w-2 h-2 rounded-full bg-mint-400/70" />
              <span className="font-mono text-[10.5px] text-fog-600 ml-2 tracking-wider">sieve — wire log</span>
              {phase === "running" && <span className="ml-auto font-mono text-[10px] text-ember-300 led-fast">▮ streaming</span>}
            </div>
            <div ref={termRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed max-h-[380px]">
              {logs.length === 0 ? (
                <p className="text-fog-600">
                  <span className="text-mint-400">$</span> awaiting target — wire log streams here in real time
                  <span className="cursor-blink text-mint-400">▊</span>
                </p>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words">
                    <span className="text-fog-600 select-none">{l.t} </span>
                    <span className={TONE_CLS[l.tone]}>{l.text}</span>
                  </div>
                ))
              )}
              {phase === "running" && <span className="cursor-blink text-mint-400">▊</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
