import { useCallback, useEffect, useRef, useState } from "react";
import { onModelProgress, type ModelProgress } from "./embed";
import { needsReclustering, processPending, recluster, type PipelineStep } from "./pipeline";

export type PipelineStatus =
  { kind: "idle" } | { kind: "error"; message: string } | ({ kind: "busy" } & PipelineStep);

/** Drives the semantic pipeline from the UI: one run at a time, re-run if asked while busy. */
export function usePipeline(onChanged: () => Promise<void> | void) {
  const [status, setStatus] = useState<PipelineStatus>({ kind: "idle" });
  const [model, setModel] = useState<ModelProgress>({ loaded: 0, total: 0, ready: false });
  const running = useRef(false);
  const again = useRef(false);
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;

  useEffect(() => onModelProgress(setModel), []);

  const run = useCallback(async (options: { reorganize?: boolean } = {}) => {
    if (running.current) {
      again.current = true;
      return 0;
    }
    running.current = true;
    const report = (step: PipelineStep) => setStatus({ kind: "busy", ...step });
    let groups = 0;
    try {
      let reorganize = options.reorganize ?? false;
      do {
        again.current = false;
        const processed = await processPending(report);
        const need = reorganize ? { needed: true, first: true } : await needsReclustering();
        if (need.needed) groups = await recluster(report, { relayout: need.first });
        reorganize = false;
        if (processed || groups) await changedRef.current();
      } while (again.current);
      setStatus({ kind: "idle" });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Elaborazione AI non riuscita.",
      });
    } finally {
      running.current = false;
    }
    return groups;
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return { status, model, run };
}

/** Human-readable status line, or null when there is nothing to say. */
export function describeStatus(status: PipelineStatus, model: ModelProgress): string | null {
  if (status.kind === "error") return status.message;
  if (!model.ready && model.total > 0 && model.loaded < model.total)
    return `Scarico il modello AI locale (solo la prima volta) · ${Math.round((model.loaded / model.total) * 100)}%`;
  if (status.kind !== "busy") return null;
  if (status.phase === "linking") {
    if (!model.ready) return "Preparo il modello AI locale…";
    return `Collego le idee · ${status.done}/${status.total}`;
  }
  if (status.phase === "clustering") return "Riconosco le costellazioni…";
  return "Do un nome alle costellazioni…";
}
