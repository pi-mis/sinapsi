import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
export const ARCHIVE_TABLES = ['sources','contacts','clusters','notes','tags','entities','edges','note_tags','note_entities','graph_settings'] as const;
type Row = Record<string, unknown>;
export type Archive = { version: 1; exported_at: string; tables: Record<(typeof ARCHIVE_TABLES)[number], Row[]> };
export function validateArchive(input: unknown): Archive {
  if (!input || typeof input !== 'object') throw new Error('Archivio non valido.');
  const archive = input as Archive;
  if (archive.version !== 1 || !archive.tables) throw new Error('Formato di archivio non compatibile.');
  const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
  for (const table of ARCHIVE_TABLES) {
    const rows = archive.tables[table];
    if (!Array.isArray(rows) || rows.length > 100000 || rows.some(r => !r || typeof r !== 'object' || Array.isArray(r))) throw new Error(`Dati mancanti o non validi: ${table}`);
    const seen = new Set();
    for (const row of rows) {
      if ('id' in row && (typeof row.id !== 'string' || !uuid.test(row.id))) throw new Error('Identificatore non valido.');
      const identity = row.id ?? (table === 'clusters' ? row.cluster_id : table === 'graph_settings' ? 'settings' : `${row.note_id}/${row.tag_id ?? row.entity_id}`);
      if (seen.has(identity)) throw new Error('L’archivio contiene dati duplicati.'); seen.add(identity);
    }
  }
  const ids = (table: (typeof ARCHIVE_TABLES)[number]) => new Set(archive.tables[table].map(r => r.id));
  const notes = ids('notes'), tags = ids('tags'), entities = ids('entities'), sources = ids('sources');
  for (const n of archive.tables.notes) {
    if (typeof n.content !== 'string' || typeof n.title !== 'string' || typeof n.is_private !== 'boolean') throw new Error('Una nota contiene dati non validi.');
    if (n.source_id && !sources.has(n.source_id)) throw new Error('Fonte della nota mancante.');
    for (const axis of ['pos_x','pos_y','pos_z']) if (n[axis] != null && (typeof n[axis] !== 'number' || !Number.isFinite(n[axis]))) throw new Error('Posizione della nota non valida.');
  }
  for (const e of archive.tables.edges) if (!notes.has(e.a) || !notes.has(e.b)) throw new Error('Una connessione fa riferimento a una nota mancante.');
  for (const link of archive.tables.note_tags) if (!notes.has(link.note_id) || !tags.has(link.tag_id)) throw new Error('Tag collegato mancante.');
  for (const link of archive.tables.note_entities) if (!notes.has(link.note_id) || !entities.has(link.entity_id)) throw new Error('Entità collegata mancante.');
  return archive;
}
export function createZip(archive: Archive) {
  validateArchive(archive);
  const files: Record<string, Uint8Array> = { 'notes.json': strToU8(JSON.stringify(archive, null, 2)) };
  const notes = archive.tables.notes;
  for (const n of notes) {
    const tags = archive.tables.note_tags.filter(l => l.note_id === n.id).map(l => archive.tables.tags.find(t => t.id === l.tag_id)?.name).filter(Boolean);
    const links = archive.tables.edges.filter(e => e.a === n.id || e.b === n.id).map(e => notes.find(other => other.id === (e.a === n.id ? e.b : e.a))).filter(Boolean);
    const filename = `${String(n.title || 'Senza titolo').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 70)}--${n.id}`;
    const text = `---\ntitle: ${JSON.stringify(n.title)}\ntags: ${JSON.stringify(tags)}\ncreated: ${JSON.stringify(n.created_at)}\nevent_date: ${JSON.stringify(n.event_date ?? null)}\nprivate: ${n.is_private}\n---\n\n${n.content}\n${n.enriched ? `\n## Approfondimento AI\n\n${n.enriched}\n` : ''}\n${links.length ? `## Connessioni\n\n${links.map(l => `- [[${String(l?.title || 'Senza titolo').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0,70)}--${l?.id}|${l?.title}]]`).join('\n')}` : ''}`;
    files[`markdown/${filename}.md`] = strToU8(text);
  }
  return zipSync(files);
}
export function readZip(bytes: Uint8Array) {
  if (bytes.length > 30 * 1024 * 1024) throw new Error('Archivio troppo grande (massimo 30 MB).');
  const files = unzipSync(bytes, { filter: file => file.name === 'notes.json' && file.originalSize < 100 * 1024 * 1024 });
  const json = files['notes.json'];
  if (!json) throw new Error('Il file notes.json manca o è troppo grande.');
  try { return validateArchive(JSON.parse(strFromU8(json))); } catch (e) { throw new Error(e instanceof Error ? e.message : 'Archivio non leggibile.'); }
}
export async function exportArchive() {
  const tables = {} as Archive['tables'];
  await Promise.all(ARCHIVE_TABLES.map(async table => {
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
      if (error) throw new Error('Impossibile esportare tutte le note.');
      rows.push(...data as unknown as Row[]); if (data.length < 1000) break;
    }
    tables[table] = rows.map(({ user_id: _user, fts: _fts, ...row }) => row);
  }));
  const archive: Archive = { version: 1, exported_at: new Date().toISOString(), tables };
  const bytes = createZip(archive);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
  const a = document.createElement('a'); a.href = url; a.download = `cervello-digitale-${archive.exported_at.slice(0,10)}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return archive.tables.notes.length;
}
export async function restoreArchive(archive: Archive) {
  validateArchive(archive);
  const { data, error } = await supabase.rpc('restore_archive', { payload: archive as unknown as Json });
  if (error) throw new Error('Importazione annullata: nessun dato è stato modificato. Verifica il tuo archivio.');
  return data;
}
