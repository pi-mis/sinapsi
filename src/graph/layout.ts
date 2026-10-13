import type { LayoutIn, LayoutOut } from "./layout.worker";

/** Runs the force layout off the main thread. */
export function runLayout(input: LayoutIn): Promise<LayoutOut["positions"]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<LayoutOut>) => {
      resolve(e.data.positions);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(e);
      worker.terminate();
    };
    worker.postMessage(input);
  });
}
