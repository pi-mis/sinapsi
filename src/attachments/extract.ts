import { MAX_EXTRACT } from "./kinds";

/**
 * Text extraction that runs in the browser, so documents are read for free and
 * their content never needs a third party. pdf.js is loaded from a pinned CDN
 * build (legacy build for older Safari), like the embedding model.
 */
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/legacy/build";
const MAX_PAGES = 40;

type TextItem = { str?: string; hasEOL?: boolean };
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: Uint8Array }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{ getTextContent(): Promise<{ items: TextItem[] }> }>;
    }>;
  };
};

let pdfjs: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= (async () => {
    const lib = (await import(/* @vite-ignore */ `${PDFJS}/pdf.min.mjs`)) as PdfJs;
    lib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
    return lib;
  })();
  pdfjs.catch(() => {
    pdfjs = null;
  });
  return pdfjs;
}

export function clip(text: string): string {
  const clean = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return clean.length > MAX_EXTRACT ? clean.slice(0, MAX_EXTRACT) : clean;
}

export async function extractPdfText(file: File): Promise<string> {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const parts: string[] = [];
  let length = 0;
  for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES) && length < MAX_EXTRACT; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items.map((i) => (i.str ?? "") + (i.hasEOL ? "\n" : " ")).join("");
    parts.push(text);
    length += text.length;
  }
  return clip(parts.join("\n\n"));
}

export async function extractPlainText(file: File): Promise<string> {
  return clip(await file.slice(0, MAX_EXTRACT * 4).text());
}
