import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Generative AI runs on Groq's free tier with open-weight models.
 * Embeddings never come here: they are computed in the browser (see src/ai/embed.ts).
 * Private notes must never be passed to these helpers.
 */
export const GROQ_MODELS = {
  /** Answers and synthesis. */
  chat: "openai/gpt-oss-120b",
  /** Short, cheap tasks: constellation names, single-connection explanations. */
  fast: "openai/gpt-oss-20b",
} as const;

const DEFAULT_DAILY_CAP = 200;

export class AiUnavailableError extends Error {}

function groq() {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey)
    throw new AiUnavailableError("L'AI non è configurata: manca il secret GROQ_API_KEY.");
  return createOpenAICompatible({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });
}

/** Counts one call against the user's daily cap (graph_settings.daily_ai_cap). */
async function consumeQuota(client: SupabaseClient<Database>) {
  const day = new Date().toISOString().slice(0, 10);
  const [{ data: settings }, { data: usage }] = await Promise.all([
    client.from("graph_settings").select("daily_ai_cap").maybeSingle(),
    client.from("ai_usage").select("calls").eq("day", day).maybeSingle(),
  ]);
  const cap = settings?.daily_ai_cap ?? DEFAULT_DAILY_CAP;
  const used = usage?.calls ?? 0;
  if (used >= cap)
    throw new AiUnavailableError(`Hai raggiunto il limite di ${cap} richieste AI per oggi.`);
  await client.from("ai_usage").upsert({ day, calls: used + 1 }, { onConflict: "user_id,day" });
}

function describe(error: unknown): string {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401) return "La chiave Groq non è valida.";
    if (error.statusCode === 429)
      return "Limite gratuito di Groq raggiunto per ora: riprova tra qualche minuto.";
    if (error.statusCode && error.statusCode >= 500) return "Groq non risponde in questo momento.";
  }
  return error instanceof Error ? error.message : "AI non disponibile.";
}

export async function askGroq(
  client: SupabaseClient<Database>,
  options: {
    model: keyof typeof GROQ_MODELS;
    system: string;
    prompt: string;
    maxOutputTokens?: number;
  },
): Promise<string> {
  const provider = groq();
  await consumeQuota(client);
  try {
    const { text } = await generateText({
      model: provider(GROQ_MODELS[options.model]),
      system: options.system,
      prompt: options.prompt,
      maxRetries: 1,
      maxOutputTokens: options.maxOutputTokens ?? 1200,
      providerOptions: { groq: { reasoningEffort: "low" } },
    });
    const out = text.trim();
    if (!out) throw new AiUnavailableError("L'AI non ha restituito una risposta.");
    return out;
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    throw new AiUnavailableError(describe(error));
  }
}

/** Extracts the first JSON object from a model answer (models sometimes wrap it in prose). */
export function extractJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
