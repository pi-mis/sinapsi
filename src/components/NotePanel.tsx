import { useQuery } from '@tanstack/react-query';
import { X, Pencil, Trash2, LockKeyhole, Pin } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { readNote, deleteNote, type Note } from '@/notes/data';
import type { GraphData } from '@/graph/data';
import { toast } from 'sonner';
export function NotePanel({ id, data, onClose, onSelect, onEdit, onDeleted }: { id: string; data: GraphData; onClose: () => void; onSelect: (id: string) => void; onEdit: (note: Note) => void; onDeleted: () => void }) {
  const { data: note, isLoading, error } = useQuery({ queryKey: ['note', id], queryFn: () => readNote(id) });
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const idx = data.nodes.findIndex(n => n.id === id);
  const linked = data.edges.filter(e => e.a === idx || e.b === idx).flatMap(e => { const node = data.nodes[e.a === idx ? e.b : e.a]; return node ? [{ node, score: e.score }] : []; });
  return <aside className="panel-shadow fixed inset-0 z-40 flex flex-col overflow-hidden border border-border bg-card md:inset-y-4 md:left-auto md:right-4 md:w-[380px] md:rounded-lg">
    <header className="flex items-start justify-between gap-3 border-b border-border p-5"><div className="min-w-0"><div className="flex items-center gap-2 text-xs text-muted-foreground">{note?.type ?? 'nota'}{note?.is_private && <LockKeyhole className="size-3" />}{note?.pinned && <Pin className="size-3" />}</div><h2 className="mt-2 break-words text-xl font-light">{note?.title || data.nodes[idx]?.title}</h2></div><Button onClick={onClose} aria-label="Chiudi nota" size="icon" variant="ghost"><X /></Button></header>
    <div className="flex-1 space-y-6 overflow-y-auto p-5">{isLoading && <p className="text-sm text-muted-foreground">Caricamento…</p>}{error && <p className="text-sm text-destructive">{(error as Error).message}</p>}{note && <><p className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleDateString('it-IT')}{note.event_date && ` · Evento: ${new Date(note.event_date).toLocaleDateString('it-IT')}`}</p><section><h3 className="mb-3 text-xs text-muted-foreground">Originale</h3><p className="whitespace-pre-wrap break-words text-sm leading-7">{note.content}</p></section>{note.enriched && <section><h3 className="mb-3 text-xs text-muted-foreground">Approfondimento AI</h3><p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{note.enriched}</p></section>}</>}
    <section><h3 className="mb-2 text-xs text-muted-foreground">Connessioni · {linked.length}</h3>{linked.map(l => <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal py-2 text-left font-normal" key={l.node.id} onClick={() => onSelect(l.node.id)}>{l.node.title}</Button>)}</section></div>
    {note && <footer className="border-t border-border p-4">{confirm ? <div className="space-y-3"><p className="text-sm">Eliminare questa nota e le sue connessioni?</p><div className="flex gap-2"><Button variant="ghost" onClick={() => setConfirm(false)}>Annulla</Button><Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); try { await deleteNote(id); toast.success('Nota eliminata'); onDeleted(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }}>Elimina nota</Button></div></div> : <div className="flex justify-between"><Button variant="secondary" onClick={() => onEdit(note)}><Pencil />Modifica</Button><Button variant="ghost" size="icon" aria-label="Elimina nota" onClick={() => setConfirm(true)}><Trash2 /></Button></div>}</footer>}
  </aside>;
}
