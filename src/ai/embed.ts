import { EMBED_MAX_CHARS, MODEL_DIM } from "./config";
import type { EmbedMessage, EmbedRequest } from "./embed.worker";

export type ModelProgress = { loaded: number; total: number; ready: boolean };

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>();
const listeners = new Set<(p: ModelProgress) => void>();
let progress: ModelProgress = { loaded: 0, total: 0, ready: false };

function emit(next: ModelProgress) {
  progress = next;
  listeners.forEach((l) => l(progress));
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./embed.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<EmbedMessage>) => {
    const msg = event.data;
    if (msg.type === "progress") emit({ ...progress, loaded: msg.loaded, total: msg.total });
    else if (msg.type === "ready") emit({ ...progress, ready: true });
    else {
      const job = waiting.get(msg.id);
      if (!job) return;
      waiting.delete(msg.id);
      if (msg.type === "result") job.resolve(msg.vectors);
      else job.reject(new Error(`Modello AI locale non disponibile: ${msg.message}`));
    }
  };
  worker.onerror = (event) => {
    const error = new Error(`Modello AI locale non disponibile: ${event.message}`);
    waiting.forEach((job) => job.reject(error));
    waiting.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** True on phones and tablets, where memory is tight and the 3D scene competes with the model. */
export function isConstrainedDevice() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/** Frees the model's memory (it reloads from the browser cache next time). */
export function releaseModel() {
  if (!worker || waiting.size) return;
  worker.terminate();
  worker = null;
  emit({ ...progress, ready: false });
}

/** Subscribe to the one-off model download progress. */
export function onModelProgress(listener: (p: ModelProgress) => void): () => void {
  listeners.add(listener);
  listener(progress);
  return () => listeners.delete(listener);
}

export function isModelReady() {
  return progress.ready;
}

function run(texts: string[]): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    getWorker().postMessage({ id, texts } satisfies EmbedRequest);
  });
}

/** Embeds texts locally (normalised, 384 dims). Nothing leaves the device. */
export async function embed(texts: string[], chunk = 8): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += chunk) {
    const vectors = await run(texts.slice(i, i + chunk));
    for (const v of vectors) {
      if (v.length !== MODEL_DIM) throw new Error("Dimensione del vettore inattesa.");
      out.push(v);
    }
  }
  return out;
}

/**
 * The text that represents a note for the embedding model: title, the note's own
 * words, then what its attachments say. When both are long they share the budget.
 */
export function noteText(title: string, content: string, attachments?: string | null): string {
  const head = title.trim();
  const own = content.trim();
  const extra = (attachments ?? "").trim();
  const budget = Math.max(0, EMBED_MAX_CHARS - head.length - 2);
  const ownShare = extra ? Math.max(Math.floor(budget / 2), budget - extra.length) : budget;
  const ownPart = own.slice(0, ownShare);
  const extraPart = extra.slice(0, Math.max(0, budget - ownPart.length));
  return [head, ownPart, extraPart].filter(Boolean).join("\n");
}
