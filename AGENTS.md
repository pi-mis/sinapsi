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
- Note CRUD and text search live in `src/notes/`; archive operations validate a versioned portable ZIP before a transactional restore to preserve graph relationships.
- The graph uses on-demand rendering with user-driven camera motion and instanced nodes to keep navigation stable and edges sharp.
- Phase 2 AI search reads at most the latest 100 non-private notes server-side; embedding-based retrieval belongs to subsequent AI phases.
