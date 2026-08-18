import { useEffect, useRef } from "react";
import { Icon } from "./icons";
import { countFields } from "../lib/generator";
import type { LogLine, ModuleData, ModuleStatus, Phase } from "../lib/types";

interface Props {
  modules: ModuleData[];
  statuses: Record<string, ModuleStatus>;
  logs: LogLine[];
  elapsedMs: number;
  phase: Phase;
}

const toneClass: Record<LogLine["tone"], string> = {
  info: "text-fog-300",
  ok: "text-mint-400",
  warn: "text-ember-400",
  dim: "text-fog-600",
  err: "text-blush-400",
};

function StatusTile({ mod, status }: { mod: ModuleData; status: ModuleStatus }) {
  const done = status === "done";
  const running = status === "running";
  return (
    <div
      className={`relative border p-3 transition-all duration-500 overflow-hidden ${
        done
          ? "border-mint-500/40 bg-mint-950/40"
          : running
            ? "border-ember-400/50 bg-ink-800/70"
            : "border-ink-700/60 bg-ink-900/50 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`transition-colors ${done ? "text-mint-400" : running ? "text-ember-400" : "text-fog-600"}`}>
          <Icon name={mod.icon} className="w-[18px] h-[18px]" />
        </span>
        {done ? (
          <span className="text-mint-400"><Icon name="check" className="w-3.5 h-3.5" /></span>
        ) : running ? (
          <span className="w-3 h-3 border border-ember-400 border-t-transparent rounded-full spinny" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-ink-600 mt-1" />
        )}
      </div>
      <p className={`mt-2 font-display text-[13px] font-medium leading-tight ${done || running ? "text-fog-100" : "text-fog-500"}`}>
        {mod.name}
      </p>
      <p className="mt-1 font-mono text-[10.5px] text-fog-600">
        {done ? `${countFields(mod)} fields locked` : running ? "parsing selectors…" : "queued"}
      </p>
      {running && <div className="absolute bottom-0 left-0 right-0 h-[2px] tickflow" />}
    </div>
  );
}

export function Pipeline({ modules, statuses, logs, elapsedMs, phase }: Props) {
  const termRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [logs]);

  const doneCount = modules.filter((m) => statuses[m.id] === "done").length;
  const pct = modules.length ? Math.round((doneCount / modules.length) * 100) : 0;
  const secs = (elapsedMs / 1000).toFixed(1);

  return (
    <section className="panel-frame reveal" id="pipeline">
      <span className="corner" />
      {/* header bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4 border-b border-ink-700/60">
        <div className="flex items-center gap-2.5">
          <Icon name="terminal" className="w-4 h-4 text-mint-400" />
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-fog-300">Extraction pipeline</span>
        </div>
        <div className="flex-1 min-w-[120px] h-[3px] bg-ink-700/60 overflow-hidden">
          <div className="h-full bg-mint-400 transition-all duration-500 shadow-[0_0_10px_rgba(62,207,142,0.7)]" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-5 font-mono text-[11px] text-fog-500">
          <span className="flex items-center gap-1.5"><Icon name="layers" className="w-3.5 h-3.5" /> {doneCount}/{modules.length} modules</span>
          <span className="flex items-center gap-1.5"><Icon name="clock" className="w-3.5 h-3.5" /> {secs}s</span>
          <span className={phase === "running" ? "text-ember-400 led" : phase === "done" ? "text-mint-400" : phase === "aborted" ? "text-blush-400" : ""}>
            {phase === "running" ? "● LIVE" : phase === "done" ? "● COMPLETE" : phase === "aborted" ? "● ABORTED" : ""}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px]">
        {/* module tiles */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {modules.map((m) => (
            <StatusTile key={m.id} mod={m} status={statuses[m.id] ?? "queued"} />
          ))}
        </div>

        {/* terminal */}
        <div className="border-t lg:border-t-0 lg:border-l border-ink-700/60 bg-ink-950/70 flex flex-col min-h-[280px]">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-700/60">
            <span className="w-2 h-2 rounded-full bg-blush-400/70" />
            <span className="w-2 h-2 rounded-full bg-ember-400/70" />
            <span className="w-2 h-2 rounded-full bg-mint-400/70" />
            <span className="ml-2 font-mono text-[10.5px] text-fog-600">sieve@maxun-core — /var/log/scrape</span>
          </div>
          <div ref={termRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-[1.85] max-h-[360px]">
            {logs.map((l, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-fog-600 select-none shrink-0">{l.t}</span>
                <span className={toneClass[l.tone]}>{l.text}</span>
              </div>
            ))}
            {phase === "running" && (
              <div className="flex items-center gap-2 text-mint-400">
                <span className="w-2 h-3.5 bg-mint-400 cursor-blink" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
