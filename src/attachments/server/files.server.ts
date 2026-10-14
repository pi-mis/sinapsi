import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BUCKET, MAX_BYTES, MAX_EXTRACT } from "../kinds";

/**
 * Storage is used only through the service role on the server, scoped by the
 * `<userId>/<noteId>/` path prefix that callers must check. This avoids needing
 * Storage RLS policies (a database migration) while keeping files private.
 */

let bucketReady: Promise<void> | null = null;

export function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const { data } = await supabaseAdmin.storage.getBucket(BUCKET);
    if (data) return;
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
    });
    if (error && !/already exists/i.test(error.message))
      throw new Error("Archivio dei file non disponibile.");
  })();
  bucketReady.catch(() => {
    bucketReady = null;
  });
  return bucketReady;
}

export async function signedUploadUrl(path: string) {
  await ensureBucket();
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("Impossibile preparare il caricamento.");
  return { path: data.path, token: data.token };
}

export async function signedUrls(paths: string[], seconds = 3600): Promise<Record<string, string>> {
  if (!paths.length) return {};
  await ensureBucket();
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, seconds);
  if (error || !data) throw new Error("Impossibile aprire gli allegati.");
  const out: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}

export async function removeFile(path: string) {
  await supabaseAdmin.storage.from(BUCKET).remove([path]);
}

const BLOCKED_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|172\.(1[6-9]|2\d|3[01])\.)/i;

function decode(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

function meta(html: string, name: string) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "").trim() : "";
}

/** Parses and validates a public http(s) URL (webcal:// is accepted for calendars). */
export function publicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    throw new Error("Il link non è valido.");
  }
  if (!/^https?:$/.test(url.protocol) || BLOCKED_HOST.test(url.hostname))
    throw new Error("Questo link non si può aprire.");
  return url;
}

/** Fetches a public web page and returns its title, description and readable text. */
export async function readLink(
  raw: string,
): Promise<{ url: string; title: string; description: string; text: string }> {
  const url = publicUrl(raw);
  let html = "";
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Sinapsi/1.0)",
        Accept: "text/html,*/*;q=0.5",
      },
    });
    const type = response.headers.get("content-type") ?? "";
    if (response.ok && type.includes("html")) html = (await response.text()).slice(0, 1_500_000);
  } catch {
    html = "";
  }
  const title =
    decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim() ||
    meta(html, "og:title") ||
    url.hostname;
  const description = meta(html, "description") || meta(html, "og:description");
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_EXTRACT);
  return {
    url: url.toString(),
    title: title.slice(0, 200),
    description: description.slice(0, 500),
    text,
  };
}
