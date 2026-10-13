import { useState } from 'react';
import { X, LockKeyhole, Save } from 'lucide-react';
import { Button } from './ui/button';
import { saveNote, type Note, type NoteInput } from '@/notes/data';
import { toast } from 'sonner';
export function NoteEditor({ note, onClose, onSaved }: { note?: Note; onClose: () => void; onSaved: (id: string) => void }) {
  const [value, setValue] = useState<NoteInput>({ title: note?.title ?? '', content: note?.content ?? '', type: note?.type ?? 'idea', is_private: note?.is_private ?? false, pinned: note?.pinned ?? false, event_date: note?.event_date ?? null });
  const [busy, setBusy] = useState(false);
  const field = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="editor-title">
    <form className="panel-shadow flex max-h-[92dvh] w-full max-w-xl flex-col rounded-lg border border-border bg-card" onSubmit={async e => { e.preventDefault(); setBusy(true); try { onSaved(await saveNote(value, note?.id)); toast.success('Nota salvata'); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); } }}>
      <header className="flex items-center justify-between border-b border-border p-4"><h2 id="editor-title" className="text-lg font-light">{note ? 'Modifica nota' : 'Nuova nota'}</h2><Button type="button" size="icon" variant="ghost" aria-label="Chiudi editor" onClick={onClose}><X /></Button></header>
      <div className="space-y-4 overflow-y-auto p-5"><label className="block space-y-1 text-xs text-muted-foreground"><span>Titolo</span><input aria-label="Titolo" className={field} value={value.title} onChange={e => setValue({ ...value, title: e.target.value })} /></label><label className="block space-y-1 text-xs text-muted-foreground"><span>Testo originale</span><textarea autoFocus required aria-label="Testo originale" className={`${field} min-h-48 resize-y`} value={value.content} onChange={e => setValue({ ...value, content: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-xs text-muted-foreground"><span>Tipo</span><input list="note-types" aria-label="Tipo" className={field} value={value.type} onChange={e => setValue({ ...value, type: e.target.value })} /><datalist id="note-types">{['idea','concetto','libro','ricetta','ricordo','progetto','musica'].map(t => <option key={t}>{t}</option>)}</datalist></label><label className="space-y-1 text-xs text-muted-foreground"><span>Data evento</span><input type="date" aria-label="Data evento" className={field} value={value.event_date ?? ''} onChange={e => setValue({ ...value, event_date: e.target.value || null })} /></label></div>
      <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={value.is_private} onChange={e => setValue({ ...value, is_private: e.target.checked })} /><LockKeyhole className="size-4 text-muted-foreground" />Privata</label><label className="flex items-center gap-2"><input type="checkbox" checked={value.pinned} onChange={e => setValue({ ...value, pinned: e.target.checked })} />In evidenza</label></div></div>
      <footer className="flex justify-end gap-2 border-t border-border p-4"><Button type="button" variant="ghost" onClick={onClose}>Annulla</Button><Button type="submit" disabled={busy}><Save />{busy ? 'Salvataggio…' : 'Salva nota'}</Button></footer>
    </form></div>;
}
