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
- Server-side AI logic will use TanStack server functions (not Edge Functions), calling Gemini directly with a user secret, per the user's spec.
