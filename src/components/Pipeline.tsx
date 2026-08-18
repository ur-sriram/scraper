import { useEffect, useRef } from "react";
import { Icon } from "./icons";
import { SOURCE_PLAN, type SourceId, type Tone } from "../lib/engine";
import type { Phase } from "../lib/types";

export type SourceUi = "off" | "queued" | "running" | "ok" | "partial" | "failed";
export type ModuleUi = "pending" | "active" | "done";

interface PipelineProps {
  sourceStatus: Record<SourceId, SourceUi>;
  moduleStatus: Record<string, ModuleUi>;
  logs: { t: string; text: string; tone: Tone }[];
  elapsed: number;
  phase: Phase;
}

const SRC_CHIP: Record<SourceUi, { txt: string; cls: string; dot: string }> = {
  off: { txt: "SKIPPED", cls: "text-fog-600 border-ink-600/60", dot: "bg-fog-600/50" },
  queued: { txt: "QUEUED", cls: "text-fog-300 border-ink-600", dot: "bg-fog-500" },
  running: { txt: "ON THE WIRE", cls: "text-ember-300 border-ember-400/50", dot: "bg-ember-400 led-fast" },
  ok: { txt: "LIVE DATA", cls: "text-mint-300 border-mint-400/50", dot: "bg-mint-400" },
  partial: { txt: "AUTHWALL", cls: "text-ember-300 border-ember-400/50", dot: "bg-ember-400" },
  failed: { txt: "FAILED", cls: "text-blush-400 border-blush-400/50", dot: "bg-blush-400" },
};

const TONE_CLS: Record<Tone, string> = {
  info: "text-skyx-300",
  ok: "text-mint-300",
  warn: "text-ember-300",
  err: "text-blush-400",
  dim: "text-fog-500",
};

export function Pipeline({ sourceStatus, moduleStatus, logs, elapsed, phase }: PipelineProps) {
  const termRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const secs = (elapsed / 1000).toFixed(1);

  return (
    <section id="pipeline" className="grid lg:grid-cols-[0.95fr_1.05fr] gap-5">
      {/* -------- source boards -------- */}
      <div className="panel-frame p-5">
        <span className="corner" aria-hidden="true" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-[11px] tracking-[0.18em] text-fog-500">EXTRACTION BOARD</h3>
          <span className={`font-mono text-xs ${phase === "running" ? "text-ember-300" : "text-fog-300"}`}>
            {phase === "running" ? (
              <span className="inline-flex items-center gap-2">
                <span className="tickflow inline-block w-14 h-0.5 align-middle" />
                T+{secs}s
              </span>
            ) : (
              `${secs}s total`
            )}
          </span>
        </div>

        <div className="space-y-4">
          {SOURCE_PLAN.map((src) => {
            const st = sourceStatus[src.id] ?? "queued";
            const chip = SRC_CHIP[st];
            const dimmed = st === "off";
            return (
              <div
                key={src.id}
                className={`border transition-colors duration-300 ${
                  st === "running"
                    ? "border-ember-400/40 bg-ember-400/[0.03]"
                    : st === "ok"
                      ? "border-mint-400/30 bg-mint-400/[0.02]"
                      : st === "failed"
                        ? "border-blush-400/40 bg-blush-400/[0.03]"
                        : "border-ink-700/70"
                } ${dimmed ? "opacity-40" : ""}`}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-ink-800/80">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon name={src.icon} className="w-4 h-4 text-fog-300 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-sm text-fog-100 leading-tight">{src.label}</div>
                      <div className="font-mono text-[10px] text-fog-600 truncate">{src.endpoint}</div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider border px-2 py-1 shrink-0 ${chip.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${chip.dot}`} />
                    {chip.txt}
                  </span>
                </div>
                <ul className="px-4 py-2.5 space-y-1.5">
                  {src.modules.map((m) => {
                    const ms = moduleStatus[m.key] ?? "pending";
                    return (
                      <li key={m.key} className="flex items-center gap-2.5 text-xs">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            ms === "done"
                              ? "bg-mint-400"
                              : ms === "active"
                                ? "bg-ember-400 led-fast"
                                : "bg-ink-600"
                          }`}
                        />
                        <span className={ms === "done" ? "text-fog-300" : ms === "active" ? "text-ember-300" : "text-fog-600"}>
                          {m.name}
                        </span>
                        {ms === "done" && <Icon name="check" className="w-3 h-3 text-mint-400 ml-auto" strokeWidth={2.4} />}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* -------- terminal -------- */}
      <div className="panel-frame flex flex-col min-h-[380px]">
        <span className="corner" aria-hidden="true" />
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-800/80">
          <div className="flex items-center gap-2">
            <Icon name="terminal" className="w-4 h-4 text-mint-400" />
            <h3 className="font-mono text-[11px] tracking-[0.18em] text-fog-500">WIRE LOG</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blush-400/70" />
            <span className="w-2 h-2 rounded-full bg-ember-400/70" />
            <span className="w-2 h-2 rounded-full bg-mint-400/70" />
          </div>
        </div>
        <div ref={termRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-[1.75] max-h-[440px]">
          {logs.length === 0 && (
            <div className="text-fog-600">
              <span className="text-mint-400">sieve@phase-01</span> ~ awaiting target handles…
              <span className="cursor-blink text-mint-400">▌</span>
            </div>
          )}
          {logs.map((l, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-fog-600 shrink-0 select-none">{l.t}</span>
              <span className={TONE_CLS[l.tone]}>{l.text}</span>
            </div>
          ))}
          {phase === "running" && (
            <div className="text-mint-400">
              <span className="cursor-blink">▌</span>
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-ink-800/80 flex items-center justify-between font-mono text-[10px] text-fog-600">
          <span>{logs.length} lines</span>
          <span>streamed in-browser · no backend</span>
        </div>
      </div>
    </section>
  );
}
