import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { MODEL_DIM } from "@/ai/config";

export type SearchResult = { id: string; title: string; type: string; similarity?: number };
export type SearchResponse = { results: SearchResult[]; answer: string; error: string };

export const searchIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      query: z.string().trim().min(1).max(500),
      mode: z.enum(["keyword", "ai"]),
      // Query vector computed on-device; absent if the local model is unavailable.
      embedding: z.array(z.number().finite()).length(MODEL_DIM).optional(),
    }),
  )
  .handler(async ({ data, context }): Promise<SearchResponse> => {
    try {
      const { data: matches, error } = await context.supabase
        .from("notes")
        .select("id,title,type")
        .textSearch("fts", data.query, { type: "websearch", config: "simple" })
        .limit(30);
      if (error) throw new Error("Ricerca non disponibile. Riprova.");
      if (data.mode === "keyword") return { results: matches ?? [], answer: "", error: "" };
      const { askMemory } = await import("./server/search.server");
      return await askMemory(context.supabase, data.query, data.embedding, matches ?? []);
    } catch (error) {
      return {
        results: [],
        answer: "",
        error: error instanceof Error ? error.message : "Ricerca non disponibile.",
      };
    }
  });
