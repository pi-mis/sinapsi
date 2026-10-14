<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Graph code lives in `src/graph/` (data loading, force layout Web Worker, demo seed, R3F scene); keep it isolated so UI edits don't break it.
- The 3D scene is lazy-loaded client-side only (`React.lazy`) because three.js/WebGL can't run during SSR.
- Initial graph load fetches only lightweight fields (id, title, type, weight, cluster, positions, edges); full note content loads on click — keeps payload small for thousands of notes.
- Saved positions (pos_x/y/z) are reused; only notes without positions get laid out, with existing ones fixed — stable layout.
- Server-side AI logic uses authenticated TanStack server functions (not Edge Functions), with providers confined to server-only modules to protect credentials.
- Generative AI runs on Groq (open-weight `openai/gpt-oss-120b` for answers, `openai/gpt-oss-20b` for short tasks) via `src/ai/groq.server.ts`, keyed by the `GROQ_API_KEY_SINAPSI` secret. Do not reintroduce the Lovable AI gateway. Every call counts against `graph_settings.daily_ai_cap` (default 200/day) in `ai_usage`.
- Embeddings are computed on-device in `src/ai/embed.worker.ts` (Transformers.js loaded from a pinned jsDelivr build, model `Xenova/multilingual-e5-small`, 384 dims). They are zero-padded into the existing `vector(768)` column, which preserves cosine similarity, so no migration is needed. Tunable thresholds live in `src/ai/config.ts`.
- The semantic pipeline (`src/ai/pipeline.ts`, driven by `usePipeline`) runs in the browser: notes with `ai_status = 'pending'` get a vector, up to 5 `semantic` edges from `match_notes`, a content-based `weight`, and the constellation of their nearest neighbour. Constellations (k-means, ids from 10 up so they never clash with demo clusters 0–5) are recomputed as the memory grows; names come from Groq, hues are spread by golden angle and stored in `clusters`.
- Private notes are embedded and linked locally, but their content is never sent to Groq (chat answers, constellation names and connection explanations all skip them).
- The AI chat is RAG-only: local query vector + full-text retrieval, then a cited answer; with no relevant notes it says so without calling the model.
- Note CRUD and text search live in `src/notes/`; archive operations validate a versioned portable ZIP before a transactional restore to preserve graph relationships.
- The graph renders continuously so neurons can float, breathe and send pulses along synapses (falls back to on-demand rendering with no motion when the user prefers reduced motion). Camera motion stays user-driven, except the login background which rotates slowly. The force layout pulls each constellation towards its own anchor.
- Neurons, halos, synapses and background dust are custom shaders in `src/graph/shaders.ts`; all share the same `drift()` so synapses stay attached to floating neurons. Picking uses the static instance positions. Bloom and vignette come from `@react-three/postprocessing`.
- 3D labels are plain DOM nodes positioned by `LabelProjector` each frame (no drei `Html`, which mounts extra React roots and crashed on unmount).
- Mobile: safe-area insets, 16px inputs (no iOS zoom), one-finger rotate on touch, constellation chips under the header.
- Auth: email + password by default (sessions persist in localStorage), magic link and Google as alternatives; accounts created via link can add a password from the ⋯ menu.
- Phase 2's "latest 100 notes" AI search has been replaced by the Phase 3 RAG search above.
