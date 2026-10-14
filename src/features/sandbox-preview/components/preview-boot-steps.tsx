"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { formatDuration, useNow } from "@/features/conversations/components/agent-run";
import { BOOT_PHASES, type BootPhase } from "@/features/sandbox-preview/utils/boot-phase";

const STEPS: { phase: BootPhase; label: string }[] = [
  { phase: "create", label: "Create sandbox" },
  { phase: "files", label: "Write files" },
  { phase: "install", label: "Install dependencies" },
  { phase: "start", label: "Start dev server" },
];

const RING_RADIUS = 56;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
/** The reactor's tick ring: every fifth tick is longer. */
const TICKS = Array.from({ length: 60 }, (_, index) => {
  const angle = (index / 60) * 2 * Math.PI;
  const inner = index % 5 === 0 ? 63 : 65;
  return {
    x1: 80 + inner * Math.cos(angle),
    y1: 80 + inner * Math.sin(angle),
    x2: 80 + 68 * Math.cos(angle),
    y2: 80 + 68 * Math.sin(angle),
  };
});
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*<>/";
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g");
const LOG_LINES = 3;

/** `T+mm:ss`, the boot's mission clock. */
const missionClock = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `T+${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
};

/** Shows `text` resolving out of random glyphs, left to right. */
const DecryptText = ({ text }: { text: string }) => {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frames = 14;
    let frame = 0;
    const timer = setInterval(() => {
      frame += 1;
      const settled = Math.floor((frame / frames) * text.length);
      setShown(
        [...text]
          .map((char, index) =>
            index < settled || char === " "
              ? char
              : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          )
          .join(""),
      );
      if (frame >= frames) clearInterval(timer);
    }, 35);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{text}</span>
    </>
  );
};

/**
 * The preview's boot as a console readout (#254): a reactor ring with the
 * mission clock, the four boot steps with their times and the tail of the
 * live log. Elapsed time counts from mount, which is when the boot starts
 * showing.
 */
export const PreviewBootSteps = ({
  phase,
  log,
  engineLabel = "Sandbox",
  firstStepLabel,
  onShowLogs,
}: {
  /** The phase in progress; `null` before the first one is reported. */
  phase: BootPhase | null;
  /** The boot's terminal output; its last lines tail under the steps. */
  log: string;
  engineLabel?: string;
  /** WebContainer boots in the page, so its first step isn't a sandbox. */
  firstStepLabel?: string;
  /** Reveals the terminal; omitted while it is already showing. */
  onShowLogs?: () => void;
}) => {
  const [startedAt] = useState(() => Date.now());
  const now = useNow(true);
  const key = phase ?? "create";
  const current = BOOT_PHASES.indexOf(key);
  // When each phase was first seen, for the per-step times.
  const [marks, setMarks] = useState<Partial<Record<BootPhase, number>>>({});
  if (marks[key] === undefined) setMarks({ ...marks, [key]: now });
  // Half credit for the step in progress, so the ring moves as each starts.
  const progress = Math.min(1, (current + 0.5) / STEPS.length);
  const tail = log
    .replace(ANSI_ESCAPE, "")
    .split(/\r?\n|\r/)
    .filter((line) => line.trim())
    .slice(-LOG_LINES);

  return (
    <div
      role="status"
      aria-label="Starting preview"
      className="preview-boot relative size-full overflow-hidden font-mono"
    >
      <div aria-hidden="true" className="preview-boot-dots absolute inset-0" />
      <div aria-hidden="true" className="preview-boot-sweep absolute inset-x-0 top-0" />
      <div aria-hidden="true" className="preview-boot-scanlines pointer-events-none absolute inset-0 z-20" />

      <div className="relative z-10 size-full overflow-y-auto p-4">
        <div className="mx-auto flex min-h-full max-w-sm flex-col items-center justify-center gap-4 @md:gap-5">
          <div className="relative grid size-32 shrink-0 place-items-center @md:size-36 @3xl:size-44">
            <svg
              aria-hidden="true"
              viewBox="0 0 160 160"
              className="absolute inset-0 size-full text-[var(--hud)]"
            >
              <circle
                cx="80"
                cy="80"
                r="76"
                fill="none"
                stroke="var(--hud-dim)"
                strokeWidth="1"
                strokeDasharray="1 5"
                className="preview-boot-spin"
              />
              <g className="preview-boot-spin-reverse" stroke="var(--hud-dim)" strokeWidth="1">
                {TICKS.map((tick, index) => (
                  <line key={index} {...tick} />
                ))}
              </g>
              <circle cx="80" cy="80" r={RING_RADIUS} fill="none" stroke="var(--hud-dim)" strokeWidth="1" />
              <circle
                cx="80"
                cy="80"
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH * (1 - progress)}
                transform="rotate(-90 80 80)"
                className="transition-[stroke-dashoffset] duration-700 ease-out [filter:drop-shadow(0_0_4px_var(--hud))]"
              />
              <circle
                cx="80"
                cy="80"
                r="46"
                fill="none"
                stroke="var(--hud-dim)"
                strokeWidth="1"
                strokeDasharray="12 4 2 4"
                className="preview-boot-spin"
              />
            </svg>
            <div className="relative flex flex-col items-center gap-0.5">
              <span className="text-lg font-medium tabular-nums tracking-wider text-[var(--hud)] [text-shadow:0_0_12px_var(--hud-dim)] @md:text-xl @3xl:text-2xl">
                {missionClock(now - startedAt)}
              </span>
              <span className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                Boot {Math.round(progress * 100)}%
              </span>
            </div>
          </div>

          <div className="preview-boot-panel relative w-full rounded-md border border-[var(--hud-dim)] bg-background/70 text-[11px] backdrop-blur-sm">
            {/* HUD corner brackets */}
            {[
              "left-0 top-0 border-l border-t",
              "right-0 top-0 border-r border-t",
              "bottom-0 left-0 border-b border-l",
              "bottom-0 right-0 border-b border-r",
            ].map((corner) => (
              <span
                key={corner}
                aria-hidden="true"
                className={cn("absolute -m-px size-2.5 border-[var(--hud)]", corner)}
              />
            ))}

            <div className="flex items-center justify-between border-b border-[var(--hud-dim)] px-3 py-2 text-[10px] uppercase tracking-[0.2em]">
              <span className="text-[var(--hud)]">{engineLabel}{" // "}Boot sequence</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span aria-hidden="true" className="preview-boot-cursor size-1.5 rounded-full bg-[var(--hud)]" />
                Live
              </span>
            </div>

            <ol className="space-y-0.5 px-3 py-2">
              {STEPS.map((step, index) => {
                const state = index < current ? "done" : index === current ? "active" : "pending";
                const label = index === 0 && firstStepLabel ? firstStepLabel : step.label;
                const start = marks[step.phase];
                const end = state === "done" ? marks[BOOT_PHASES[index + 1]] : now;
                const time =
                  state !== "pending" && start !== undefined && end !== undefined
                    ? formatDuration(end - start)
                    : null;
                return (
                  <li
                    key={step.phase}
                    data-state={state}
                    aria-current={state === "active" ? "step" : undefined}
                    className="grid h-6 grid-cols-[auto_1fr_auto] items-center gap-3"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "whitespace-pre",
                        state === "pending" ? "text-muted-foreground/50" : "text-[var(--hud)]",
                        state === "active" && "preview-boot-cursor",
                      )}
                    >
                      {state === "done" ? "[ OK ]" : state === "active" ? "[ >> ]" : "[    ]"}
                    </span>
                    <span
                      className={cn(
                        "truncate uppercase tracking-wider",
                        state === "pending" ? "text-muted-foreground/60" : "text-foreground",
                      )}
                    >
                      {state === "active" ? <DecryptText key={label} text={label} /> : label}
                      <span className="sr-only">
                        {state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}
                      </span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">{time}</span>
                  </li>
                );
              })}
            </ol>

            <div
              aria-hidden="true"
              className="space-y-0.5 border-t border-dashed border-[var(--hud-dim)] px-3 py-2 text-[10px] text-muted-foreground"
            >
              {tail.length === 0 ? (
                <p>
                  &gt; awaiting output<span className="preview-boot-cursor">_</span>
                </p>
              ) : (
                tail.map((line, index) => (
                  <p key={`${tail.length}-${index}`} className="truncate">
                    &gt; {line}
                    {index === tail.length - 1 && (
                      <span className="preview-boot-cursor ml-0.5 inline-block h-2.5 w-1.5 translate-y-0.5 bg-[var(--hud)]" />
                    )}
                  </p>
                ))
              )}
            </div>
          </div>

          {onShowLogs && (
            <button
              type="button"
              onClick={onShowLogs}
              className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-[var(--hud)]"
            >
              &gt; Show logs
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
