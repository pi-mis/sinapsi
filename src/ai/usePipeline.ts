import { useCallback, useEffect, useRef, useState } from "react";
import { isConstrainedDevice, onModelProgress, releaseModel, type ModelProgress } from "./embed";
import {
  countFailed,
  needsReclustering,
  processPending,
  recluster,
  retryFailed,
  type PipelineStep,
} from "./pipeline";

export type PipelineStatus =
  | { kind: "idle" }
  | { kind: "error"; message: string; retryFailed?: boolean }
  | ({ kind: "busy" } & PipelineStep);

/** Drives the semantic pipeline from the UI: one run at a time, re-run if asked while busy. */
export function usePipeline(
  onChanged: () => Promise<void> | void,
  onProcessed?: (ids: string[]) => void,
) {
  const [status, setStatus] = useState<PipelineStatus>({ kind: "idle" });
  const [model, setModel] = useState<ModelProgress>({ loaded: 0, total: 0, ready: false });
  const running = useRef(false);
  const again = useRef(false);
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;
  const failedNotice = useRef(false);
  const processedRef = useRef(onProcessed);
  processedRef.current = onProcessed;

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
        const { ok: processed, setAside } = await processPending(report);
        if (setAside) failedNotice.current = true;
        const need = reorganize ? { needed: true, first: true } : await needsReclustering();
        if (need.needed) groups = await recluster(report, { relayout: need.first });
        reorganize = false;
        if (processed.length) processedRef.current?.(processed);
        if (processed.length || groups) await changedRef.current();
      } while (again.current);
      const failed = await countFailed();
      setStatus(
        failed
          ? {
              kind: "error",
              message: `${failed === 1 ? "1 nota non è stata collegata" : `${failed} note non sono state collegate`}${failedNotice.current ? " (il telefono ha esaurito la memoria)" : ""}.`,
              retryFailed: true,
            }
          : { kind: "idle" },
      );
      failedNotice.current = false;
    } catch (error) {
      console.error("[Sinapsi] elaborazione AI", error);
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Elaborazione AI non riuscita.",
      });
    } finally {
      running.current = false;
      // On phones the model's memory is given back to the 3D scene between runs.
      if (isConstrainedDevice()) releaseModel();
    }
    return groups;
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  /** Puts failed notes back in the queue and runs again. */
  const retry = useCallback(async () => {
    await retryFailed();
    await run();
  }, [run]);

  return { status, model, run, retry };
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
