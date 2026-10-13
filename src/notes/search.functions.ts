import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
export const searchIdeas = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ query: z.string().trim().min(1).max(500), mode: z.enum(['keyword','ai']) })).handler(async ({ data, context }) => {
  try {
    const query = data.query;
    const { data: matches, error } = await context.supabase.from('notes').select('id,title,type').textSearch('fts', query, { type: 'websearch', config: 'simple' }).limit(30);
    if (error) throw new Error('Ricerca non disponibile. Riprova.');
    if (data.mode === 'keyword') return { results: matches ?? [], answer: '', error: '' };
    const { searchWithAI } = await import('./server/search.server');
    return await searchWithAI(context.supabase, query);
  } catch (error) { return { results: [], answer: '', error: error instanceof Error ? error.message : 'Ricerca non disponibile.' }; }
});
