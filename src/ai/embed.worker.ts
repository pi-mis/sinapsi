/// <reference lib="webworker" />
import { EMBED_LIB_URL, EMBED_MODEL } from "./config";

/**
 * Local embedding worker. Transformers.js is loaded from a pinned CDN build at
 * runtime (no npm dependency, so bun.lock stays untouched); the model weights
 * (~118 MB, quantised) are downloaded once and cached by the browser.
 */

export type EmbedRequest = { id: number; texts: string[] };
export type EmbedMessage =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "result"; id: number; vectors: number[][] }
  | { type: "error"; id: number; message: string };

type Extractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;
type ProgressEvent = { status?: string; file?: string; loaded?: number; total?: number };
type TransformersLib = {
  env: { allowLocalModels: boolean };
  pipeline(
    task: "feature-extraction",
    model: string,
    options: { dtype: string; device: string; progress_callback: (event: ProgressEvent) => void },
  ): Promise<Extractor>;
};

const post = (message: EmbedMessage) => (self as unknown as Worker).postMessage(message);
const files = new Map<string, { loaded: number; total: number }>();
let extractor: Promise<Extractor> | null = null;

function load(): Promise<Extractor> {
  extractor ??= (async () => {
    const lib = (await import(/* @vite-ignore */ EMBED_LIB_URL)) as TransformersLib;
    lib.env.allowLocalModels = false;
    const model = await lib.pipeline("feature-extraction", EMBED_MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (event) => {
        if (event.status !== "progress" || !event.file || !event.total) return;
        files.set(event.file, { loaded: event.loaded ?? 0, total: event.total });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        post({ type: "progress", loaded, total });
      },
    });
    post({ type: "ready" });
    return model;
  })();
  extractor.catch(() => {
    extractor = null;
  });
  return extractor;
}

self.onmessage = async (event: MessageEvent<EmbedRequest>) => {
  const { id, texts } = event.data;
  try {
    const model = await load();
    // e5 expects a prefix; "query: " is the recommended one for symmetric tasks (linking, clustering).
    const output = await model(
      texts.map((t) => `query: ${t}`),
      { pooling: "mean", normalize: true },
    );
    post({ type: "result", id, vectors: output.tolist() });
  } catch (error) {
    post({ type: "error", id, message: error instanceof Error ? error.message : String(error) });
  }
};
